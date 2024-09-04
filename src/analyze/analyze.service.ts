import { Inject, Injectable } from '@nestjs/common';
import { ethers, JsonRpcProvider } from 'ethers';
import { getProvider, getWETHAddress, getUniswapFactoryAddress, getExplorerUrl, getBlockExplorerUrl, getTokenExplorerUrl, getAddressExplorerUrl, getLockAddress, getLockAbiInfo } from '../utils/evmUtils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AnalyzeService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }
    private async getTokenNetwork(address: string, providers: Record<string, JsonRpcProvider>): Promise<string> {
        const erc20ABI = ["function name() view returns (string)"];

        for (const [networkName, provider] of Object.entries(providers)) {
            const contract = new ethers.Contract(address, erc20ABI, provider);
            try {
                await contract.name(); // Thử gọi hàm name() để kiểm tra xem contract có tồn tại trên mạng này không
                return networkName; // Nếu không lỗi, trả về tên mạng
            } catch {
                // Nếu lỗi, tiếp tục với mạng tiếp theo
            }
        }
        return 'Unknown'; // Nếu không tìm thấy mạng nào, trả về 'Unknown'
    }

    private async getTokenCreationBlock(address: string, provider: JsonRpcProvider): Promise<{ blockNumber: number, tx: string } | null> {
        const logs = await provider.getLogs({
            address: address,
            topics: [ethers.id("Transfer(address,address,uint256)"), ethers.ZeroHash],
            fromBlock: 0,
            toBlock: 'latest'
        });

        return logs.length > 0 ? { blockNumber: logs[0].blockNumber, tx: logs[0].transactionHash } : null;
    }

    private async getTopTokenHolders(address: string, provider: JsonRpcProvider, limit = 10) {
        const creationBlock = await this.getTokenCreationBlock(address, provider);
        if (!creationBlock) {
            console.log("Không tìm thấy block tạo token.");
            return [];
        }

        const logs = await this.getLogsInChunks(
            address,
            provider,
            creationBlock.blockNumber,
            [ethers.id("Transfer(address,address,uint256)")]
        );

        const holders = logs
            .filter(log => log.topics[1] !== ethers.ZeroHash)
            .map(log => ({
                from: ethers.getAddress(log.topics[1].slice(-40)),
                to: ethers.getAddress(log.topics[2].slice(-40)),
                amount: ethers.toBigInt(log.data)
            }))
            .reduce((acc, current) => {
                const existing = acc.find(entry => entry.to === current.to);
                if (existing) {
                    existing.amount += current.amount;
                } else {
                    acc.push(current);
                }
                return acc;
            }, [] as { to: string; amount: bigint }[])
            .sort((a, b) => this.compareBigInts(b.amount, a.amount))
            .slice(0, limit);

        return holders;
    }

    private async getFirstBuyers(address: string, provider: JsonRpcProvider, limit = 10) {
        const creationBlock = await this.getTokenCreationBlock(address, provider);
        if (!creationBlock) {
            console.log("Không tìm thấy block tạo token.");
            return [];
        }

        const logs = await this.getLogsInChunks(
            address,
            provider,
            creationBlock.blockNumber,
            [ethers.id("Transfer(address,address,uint256)")]
        );

        const firstBuyers = logs
            .filter(log => log.topics[1] !== ethers.ZeroHash)
            .map(log => ({
                from: ethers.getAddress(log.topics[1].slice(-40)),
                to: ethers.getAddress(log.topics[2].slice(-40)),
                amount: ethers.toBigInt(log.data),
                blockNumber: log.blockNumber,
                tx: log.transactionHash
            }))
            .sort((a, b) => this.compareBigInts(a.blockNumber, b.blockNumber))
            .slice(0, limit);

        return firstBuyers;
    }

    private async getMintingInfo(address: string, provider: JsonRpcProvider, limit = 10) {
        const creationBlock = await this.getTokenCreationBlock(address, provider);
        if (!creationBlock) {
            console.log("Không tìm thấy block tạo token.");
            return { totalMintedAddresses: 0, firstMintedAddresses: [] };
        }

        const logs = await this.getLogsInChunks(
            address,
            provider,
            creationBlock.blockNumber,
            [ethers.id("Transfer(address,address,uint256)"), ethers.ZeroHash]
        );

        const uniqueAddresses = new Set<string>();
        const firstMintedAddresses = [];

        logs.forEach(log => {
            const toAddress = ethers.getAddress(log.topics[2].slice(-40));
            uniqueAddresses.add(toAddress);

            if (firstMintedAddresses.length < limit) {
                firstMintedAddresses.push({
                    to: toAddress,
                    amount: ethers.toBigInt(log.data),
                    blockNumber: log.blockNumber,
                    tx: log.transactionHash
                });
            }
        });

        firstMintedAddresses.sort((a, b) => this.compareBigInts(a.blockNumber, b.blockNumber));

        return {
            totalMintedAddresses: uniqueAddresses.size,
            firstMintedAddresses
        };
    }

    private async getLogsInChunks(
        address: string,
        provider: JsonRpcProvider,
        fromBlock: number,
        topics: string[],
        chunkSize = 500,
        maxIterations = 20
    ): Promise<ethers.Log[]> {
        let logs: ethers.Log[] = [];
        let currentFromBlock = fromBlock;

        // Create an array to hold promises
        const promises: Promise<ethers.Log[]>[] = [];

        for (let i = 0; i < maxIterations; i++) {
            const endBlock = currentFromBlock + chunkSize - 1;

            // Push each chunk fetching operation to the promise array
            promises.push(
                provider.getLogs({
                    address,
                    fromBlock: ethers.toQuantity(currentFromBlock),
                    toBlock: ethers.toQuantity(endBlock),
                    topics
                }).catch((error) => {
                    console.error(`Error fetching logs for block range [${currentFromBlock}, ${endBlock}]:`, error);
                    return [];
                })
            );

            currentFromBlock = endBlock + 1;
        }

        // Resolve all promises in parallel
        const chunks = await Promise.all(promises);

        // Concatenate all logs
        logs = logs.concat(...chunks);

        return logs;
    }

    private async getremainingAmounts(address: string, provider: JsonRpcProvider, wallets: { to: string; amount: bigint; blockNumber: number; tx: string }[]): Promise<any[]> {
        const erc20ABI = ["function balanceOf(address) view returns (uint256)"];
        const contract = new ethers.Contract(address, erc20ABI, provider);

        const balances = await Promise.all(
            wallets.map(async (wallet) => {
                const balance = await contract.balanceOf(wallet.to);
                return {
                    ...wallet,
                    remainingAmount: balance
                };
            })
        );

        return balances;
    }

    private async getLiquidityInfo(address: string, provider: JsonRpcProvider, factoryAddress: string, wethAddress: string): Promise<{ wethLiquidity: string, tokenLiquidity: string, pairAddress: string } | null> {
        const factoryABI = ["function getPair(address, address) view returns (address)"];
        const pairABI = [
            "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() view returns (address)",
            "function token1() view returns (address)"
        ];

        const factoryContract = new ethers.Contract(factoryAddress, factoryABI, provider);
        const pairAddress = await factoryContract.getPair(address, wethAddress);

        if (pairAddress === ethers.ZeroAddress) {
            return null;
        }

        const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
        const [reserve0, reserve1] = await pairContract.getReserves();

        // Kiểm tra thứ tự của các token trong cặp
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();

        let wethLiquidity: string;
        let tokenLiquidity: string;

        if (token0.toLowerCase() === wethAddress.toLowerCase()) {
            // WETH là token0, token reserve là reserve1
            wethLiquidity = reserve0; // WETH reserves
            tokenLiquidity = reserve1; // Token reserves (giả định 18 chữ số thập phân, cần chỉnh sửa nếu khác)
        } else if (token1.toLowerCase() === wethAddress.toLowerCase()) {
            // WETH là token1, token reserve là reserve0
            wethLiquidity = reserve1; // WETH reserves
            tokenLiquidity = reserve0; // Token reserves (giả định 18 chữ số thập phân, cần chỉnh sửa nếu khác)
        } else {
            // Trường hợp không khớp, có thể có lỗi trong địa chỉ WETH hoặc token
            return null;
        }

        return {
            wethLiquidity,
            tokenLiquidity,
            pairAddress
        };
    }

    private async checkLiquidityLock(pairAddress: string, provider: JsonRpcProvider, lockContractAddress: string): Promise<{ lockedBalance: bigint, locked: boolean }> {
        if (!pairAddress) {
            return null;
        }

        if (pairAddress === ethers.ZeroAddress) {
            return null;
        }
        const erc20ABI = ["function balanceOf(address) view returns (uint256)"];
        const lpContract = new ethers.Contract(pairAddress, erc20ABI, provider);

        try {
            const lockedBalance = await lpContract.balanceOf(lockContractAddress);
            return { lockedBalance, locked: lockedBalance > 0 }; // If the balance is greater than 0, liquidity is locked
        } catch (error) {
            console.error("Error checking liquidity lock:", error);
            return null;
        }
    }

    private async getUnlockTimeFromBaseLogs(chain: string, lockContractAddress: string, pairAddress: string, provider: JsonRpcProvider): Promise<string | null> {
        const lockAbiInfo = getLockAbiInfo(chain);
        const filter = {
            address: lockContractAddress,
            topics: [
                ethers.id(lockAbiInfo.event), // Hàm băm của sự kiện onNewLock
            ]
        };

        try {
            const logs = await provider.getLogs(filter);

            if (logs.length > 0) {
                const abiCoder = new ethers.AbiCoder();
                const unlockTimestamp = abiCoder.decode(lockAbiInfo.decode, logs[0].data)[lockAbiInfo.unlockDateIndex];
                return new Date(Number(unlockTimestamp) * 1000).toISOString();
            } else {
                console.log("Không tìm thấy logs với sự kiện tương ứng.");
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lọc logs:", error);
            return null;
        }
    }

    /**
     * Phân tích thông tin của một token ERC20
     * @param address Địa chỉ của token
     * @returns Thông tin token
     */
    async getInfo(address: string): Promise<any> {
        let tokenInfo = await this.cacheManager.get(`${address}_info`);
        if (tokenInfo) {
            return tokenInfo;
        }
        const providers = {
            ethereum: getProvider('ethereum'),
            base: getProvider('base'),
            arbitrum: getProvider('arbitrum'),
            optimism: getProvider('optimism')
        };

        const network = await this.getTokenNetwork(address, providers);

        if (network === 'Unknown') {
            throw new Error("Not found on any network");
        }

        const provider = providers[network];
        const erc20ABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function balanceOf(address) view returns (uint256)",
            "function owner() view returns (address)",
        ];
        const contract = new ethers.Contract(address, erc20ABI, provider);

        try {
            const [name, symbol, totalSupply, decimals, owner] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.totalSupply(),
                contract.decimals(),
                contract.owner()
            ]);

            const hasRenouncedOwnership = owner === ethers.ZeroAddress;


            // Kiểm tra thanh khoản trên Uniswap
            const uniswapFactoryAddress = getUniswapFactoryAddress(network);
            const wethAddress = getWETHAddress(network); // WETH address on Ethereum

            const liquidityInfo = await this.getLiquidityInfo(address, provider, uniswapFactoryAddress, wethAddress);

            const liquidityLocked = await this.checkLiquidityLock(liquidityInfo.pairAddress, provider, getLockAddress(network));

            // const lockTime = await this.getUnlockTimeFromBaseLogs(network, getLockAddress(network), liquidityInfo.pairAddress, provider);
            tokenInfo = {
                name,
                symbol,
                address: address,
                addressLink: getTokenExplorerUrl(network, address),
                totalSupply: `${totalSupply.toString()}`,
                decimals: decimals.toString(),
                owner,
                ownerLink: getExplorerUrl(network, owner),
                hasRenouncedOwnership,
                liquidity:
                {
                    info: liquidityInfo ? `${this.formatTokenAmount(liquidityInfo.tokenLiquidity, decimals, symbol)} - ${this.formatTokenAmount(liquidityInfo.wethLiquidity, 18, "ETH")}` : "No liquidity found",
                    address: liquidityInfo ? liquidityInfo.pairAddress : "No pair found",
                    link: liquidityInfo ? getAddressExplorerUrl(network, liquidityInfo.pairAddress) : null,
                    locked: liquidityLocked ? liquidityLocked.locked : false,
                    lockedBalance: liquidityLocked ? `${this.formatTokenAmount(liquidityLocked.lockedBalance, decimals, symbol)} - ${this.roundToSixDecimals(liquidityLocked.lockedBalance, totalSupply)}%` : "No liquidity lock found",
                },
                chain: network,
            };
            if (tokenInfo) {
                // cache 5p
                await this.cacheManager.set(`${address}_info`, tokenInfo, 300000);
            }
            return tokenInfo;
        } catch (error) {
            console.error(error);
            throw new Error("Not found token on any network");
        }
    }

    /**
     * Phân tích thông tin của một token ERC20
     * @param address Địa chỉ của token
     * @returns Thông tin token
     */
    async analyze(address: string): Promise<any> {
        let tokenInfo = await this.cacheManager.get(address);
        if (tokenInfo) {
            return tokenInfo;
        }
        const providers = {
            ethereum: getProvider('ethereum'),
            base: getProvider('base'),
            arbitrum: getProvider('arbitrum'),
            optimism: getProvider('optimism')
        };

        const network = await this.getTokenNetwork(address, providers);

        if (network === 'Unknown') {
            throw new Error("Not found on any network");
        }

        const provider = providers[network];
        const erc20ABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function balanceOf(address) view returns (uint256)",
            "function owner() view returns (address)",
        ];
        const contract = new ethers.Contract(address, erc20ABI, provider);

        try {
            const [name, symbol, totalSupply, decimals, owner] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.totalSupply(),
                contract.decimals(),
                contract.owner()
            ]);

            const hasRenouncedOwnership = owner === ethers.ZeroAddress;
            const creationBlock = await this.getTokenCreationBlock(address, provider);
            // const topHolders = await this.getTopTokenHolders(address, provider);
            const firstBuyers = await this.getFirstBuyers(address, provider);
            const mintingInfo = await this.getMintingInfo(address, provider);

            // Kết hợp địa chỉ từ cả người mua đầu tiên và địa chỉ minted, loại bỏ địa chỉ trùng lặp
            const combinedAddresses = [...firstBuyers, ...mintingInfo.firstMintedAddresses];
            const distinctAddresses = Array.from(new Set(combinedAddresses.map(item => item.to)))
                .map(to => combinedAddresses.find(item => item.to === to)!);

            // Lấy số dư hiện tại của các địa chỉ kết hợp
            const walletsWithBalances = await this.getremainingAmounts(address, provider, distinctAddresses);

            // Phân chia lại thông tin vào buyersWithBalances và mintersWithBalances
            const buyersWithBalances = walletsWithBalances.filter(wallet =>
                firstBuyers.some(buyer => buyer.to === wallet.to)
            );

            const mintersWithBalances = walletsWithBalances.filter(wallet =>
                mintingInfo.firstMintedAddresses.some(minter => minter.to === wallet.to)
            );

            // Kiểm tra thanh khoản trên Uniswap
            const uniswapFactoryAddress = getUniswapFactoryAddress(network);
            const wethAddress = getWETHAddress(network); // WETH address on Ethereum

            const liquidityInfo = await this.getLiquidityInfo(address, provider, uniswapFactoryAddress, wethAddress);

            const liquidityLocked = await this.checkLiquidityLock(liquidityInfo.pairAddress, provider, getLockAddress(network));

            // const lockTime = await this.getUnlockTimeFromBaseLogs(network, getLockAddress(network), liquidityInfo.pairAddress, provider);
            tokenInfo = {
                name,
                symbol,
                address: address,
                addressLink: getTokenExplorerUrl(network, address),
                totalSupply: `${totalSupply.toString()}`,
                decimals: decimals.toString(),
                owner,
                ownerLink: getExplorerUrl(network, owner),
                hasRenouncedOwnership,
                creationBlock: creationBlock ? creationBlock.blockNumber : null,
                creationBlockUrl: creationBlock ? getBlockExplorerUrl(network, creationBlock.blockNumber) : null,
                creationTx: creationBlock ? creationBlock.tx : null,
                creationLink: creationBlock ? getExplorerUrl(network, creationBlock.tx) : null,
                // topHolders: topHolders.map(holder => ({
                //     ...holder,
                //     amount: `${this.formatTokenAmount(holder.amount, decimals, symbol)} - ${this.roundToSixDecimals(holder.amount, totalSupply)}%` // Chuyển đổi BigInt thành chuỗi
                // })),
                firstBuyers: buyersWithBalances.map(buyer => ({
                    ...buyer,
                    toUrl: getExplorerUrl(network, buyer.to),
                    txUrl: getExplorerUrl(network, buyer.tx),
                    blockNumberUrl: getBlockExplorerUrl(network, buyer.blockNumber),
                    amount: `${this.formatTokenAmount(buyer.amount, decimals, symbol)} - ${this.roundToSixDecimals(buyer.amount, totalSupply)}%`,
                    remainingAmount: `${this.formatTokenAmount(buyer.remainingAmount, decimals, symbol)} - ${this.roundToSixDecimals(buyer.remainingAmount, totalSupply)}%`
                })),
                firstMinters: mintersWithBalances.map(minter => ({
                    ...minter,
                    toUrl: getExplorerUrl(network, minter.to),
                    txUrl: getExplorerUrl(network, minter.tx),
                    blockNumberUrl: getBlockExplorerUrl(network, minter.blockNumber),
                    amount: `${this.formatTokenAmount(minter.amount, decimals, symbol)} - ${this.roundToSixDecimals(minter.amount, totalSupply)}%`,
                    remainingAmount: `${this.formatTokenAmount(minter.remainingAmount, decimals, symbol)} - ${this.roundToSixDecimals(minter.remainingAmount, totalSupply)}%`
                })),
                liquidity:
                {
                    info: liquidityInfo ? `${this.formatTokenAmount(liquidityInfo.tokenLiquidity, decimals, symbol)} - ${this.formatTokenAmount(liquidityInfo.wethLiquidity, 18, "ETH")}` : "No liquidity found",
                    address: liquidityInfo ? liquidityInfo.pairAddress : "No pair found",
                    link: liquidityInfo ? getAddressExplorerUrl(network, liquidityInfo.pairAddress) : null,
                    locked: liquidityLocked ? liquidityLocked.locked : false,
                    lockedBalance: liquidityLocked ? `${this.formatTokenAmount(liquidityLocked.lockedBalance, decimals, symbol)} - ${this.roundToSixDecimals(liquidityLocked.lockedBalance, totalSupply)}%` : "No liquidity lock found",
                },
                chain: network,
            };
            if (tokenInfo) {
                // cache 5p
                await this.cacheManager.set(address, tokenInfo, 300000);
            }
            return tokenInfo;
        } catch (error) {
            console.error(error);
            throw new Error("Not found token on any network");
        }
    }

    private roundToSixDecimals(a: bigint, b: bigint) {
        // Chia a cho b và nhân với 100 để tính phần trăm
        let percent = (a * 1000000000000000000n) / b;

        // Chuyển đổi kết quả về phần trăm có 6 chữ số sau dấu phẩy
        let roundedPercent = Number(percent) / 10000000000000000;

        // Làm tròn đến 6 chữ số sau dấu phẩy
        roundedPercent = Math.round(roundedPercent * 1000000) / 1000000;
        return roundedPercent;
    }

    private formatTokenAmount(amount: any, decimals: any, symbol: any): string {
        // Chuyển đổi BigInt thành chuỗi thập phân
        const formattedAmount = ethers.formatUnits(amount, decimals);

        // Chia chuỗi thành phần nguyên và phần thập phân
        let [integerPart, decimalPart] = formattedAmount.split(".");

        // Định dạng phần nguyên với dấu phẩy phân cách hàng nghìn
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        // Nếu phần thập phân tồn tại, cắt nó theo số lượng chữ số thập phân cần hiển thị
        if (decimalPart && decimals > 0) {
            decimalPart = decimalPart.slice(0, decimals.toString());
            return `${integerPart}.${decimalPart} ${symbol}`;
        } else {
            return `${integerPart} ${symbol}`;
        }
    }

    private compareBigInts(a: number | bigint, b: number | bigint): number {
        return a > b ? 1 : a < b ? -1 : 0;
    }
}
