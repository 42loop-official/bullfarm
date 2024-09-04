import { Injectable, OnModuleInit } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { ethers } from 'ethers';
import axios from 'axios';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { Chains } from '../constants/chainConstants';
import { getAddressExplorerUrl, getExplorerUrl, getTokenExplorerUrl } from '../utils/evmUtils';
import { RedisService } from './redis.service';
import { sessionMiddleware } from './session.middleware';

@Injectable()
export class TelegramService implements OnModuleInit {
    private bot: Telegraf;

    constructor(private readonly redisService: RedisService) {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

        // Sử dụng session middleware với Redis
        this.bot.use(sessionMiddleware(this.redisService));
    }

    async onModuleInit() {
        // Khởi động bot
        this.bot.start((ctx) => {
            ctx.reply(`👋 Welcome!
                
                🔍 Use /menu to explore options.
                
                💼 Please create a wallet before trading tokens.
                
                💬 To track token information or perform trades, please send the token's contract address here.
                
                ⚠️ Note: The current beta version only supports the Ethereum and Base networks.`);
        });

        // Xử lý lệnh /menu
        this.bot.command('menu', (ctx) => {
            // check wallet
            ctx.reply(
                'Please choose an option:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            // [{ text: '💰 Buy', callback_data: 'buy' }, { text: '💵 Sell', callback_data: 'sell' }],
                            // [{ text: '📊 Analysis', callback_data: 'analysis' }],
                            [{ text: '💰 Balances', callback_data: 'balance' }],
                            [{ text: '📝 Create Wallet', callback_data: 'createWallet' }]
                        ],
                    },
                },
            );
        });

        // Xử lý lệnh /balance
        this.bot.command('balance', async (ctx) => {
            await this.handleBalanceRequest(ctx);
        });

        // Xử lý action khi người dùng chọn xem balance
        this.bot.action('balance', async (ctx) => {
            await this.handleBalanceRequest(ctx);
            await ctx.answerCbQuery();
        });

        // Xử lý sự kiện khi người dùng chọn xem balance
        this.bot.action(/balances:(\w+)(:\w+)?(:.+)?/, async (ctx) => {
            try {
                const chain = ctx.match[1];
                const tokenAddress = ctx.match[2]?.substring(1);
                const walletType = Chains.find(c => c.name === chain)?.walletType;
                const walletResult = await axios.get(`${this.getApiPath()}/wallet/${walletType}/${ctx.from.id}`);

                if (!walletResult || !walletResult.data || !walletResult.data.success) {
                    await ctx.reply('Wallet not found');
                    return;
                }
                let balanceUrl = `${this.getApiPath()}/wallet/balances/${chain}/${walletResult.data.data}`;
                if (tokenAddress) {
                    balanceUrl += `?token=${tokenAddress}`;
                }
                const balancesResult = await axios.get(balanceUrl);
                if (!balancesResult || !balancesResult.data || !balancesResult.data.success) {
                    await ctx.reply('Failed to get balance');
                    return;
                }
                await ctx.reply(`Wallet balance: *${balancesResult.data.data.format}*`, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error checking balance:', error);
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Xử lý sự kiện khi người dùng chọn xem balance
        this.bot.action(/balances:(\w+):(\w+)/, async (ctx) => {
            try {
                const chain = ctx.match[1];
                const tokenAddress = ctx.match[2];
                const walletType = Chains.find(c => c.name === chain)?.walletType;
                const walletResult = await axios.get(`${this.getApiPath()}/wallet/${walletType}/${ctx.from.id}`);

                if (!walletResult || !walletResult.data || !walletResult.data.success) {
                    await ctx.reply('Wallet not found');
                    return;
                }
                const balancesResult = await axios.get(`${this.getApiPath()}/wallet/balances/${chain}/${walletResult.data.data}?token=${tokenAddress}`);
                if (!balancesResult || !balancesResult.data || !balancesResult.data.success) {
                    await ctx.reply('Failed to get balance');
                    return;
                }
                await ctx.reply(`Wallet balance: *${balancesResult.data.data.format}*`, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error checking balance:', error);
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Xử lý sự kiện khi người dùng chọn một option
        this.bot.action('createWallet', async (ctx) => {
            await this.handlerCreateWallet(ctx)
            await ctx.answerCbQuery();
        });

        this.bot.command('createWallet', async (ctx) => {
            await this.handlerCreateWallet(ctx);
        });

        // Xử lý sự kiện khi người dùng chọn một chain để sửa wallet.
        this.bot.action(/view:wallet:(\w+)/, async (ctx) => {
            try {
                const walletType = ctx.match[1];
                const walletResult = await axios.get(`${this.getApiPath()}/wallet/${walletType}/${ctx.from.id}`);

                if (!walletResult || !walletResult.data || !walletResult.data.success) {
                    await ctx.reply('Wallet not found');
                    return;
                }

                await ctx.reply(`Wallet is already created: \`${walletResult.data.data}\``, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error editing wallet:', error);
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // this.bot.action('analysis', (ctx) => {
        //     ctx.reply('You selected Analysis');
        //     ctx.answerCbQuery();
        // });

        // this.bot.action('buy', (ctx) => {
        //     ctx.reply('Please choose chain to buy',
        //         {
        //             reply_markup: {
        //                 inline_keyboard: [
        //                     [{ text: '🦄 Ethereum', callback_data: 'buy:evm' }, { text: '⚡ Solana', callback_data: 'buy:solana' }],
        //                     [{ text: '🛡️ Base', callback_data: 'buy:base' }, { text: '💎 TON', callback_data: 'buy:ton' }],
        //                 ],
        //             },
        //         },
        //     );
        // });

        // this.bot.action('sell', (ctx) => {
        //     ctx.reply('Please choose chain to sell',
        //         {
        //             reply_markup: {
        //                 inline_keyboard: [
        //                     [{ text: '🦄 Ethereum', callback_data: 'sell:ethereum' }, { text: '⚡ Solana', callback_data: 'sell:solana' }],
        //                     [{ text: '🛡️ Base', callback_data: 'sell:base' }, { text: '💎 TON', callback_data: 'sell:ton' }],
        //                 ],
        //             },
        //         },
        //     );
        // });

        // Xử lý sự kiện khi người dùng chọn một token để mua hoặc bán
        this.bot.action(/(buy|sell):(\w+):(\w+)/, async (ctx) => {
            try {
                const action = ctx.match[1];
                const address = ctx.match[2];
                const chain = ctx.match[3];
                // gợi ý một số tiền để trade
                if (action === 'buy') {
                    ctx.reply('Please choose or enter amount to buy',
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '0.01', callback_data: `${action}_${address}_${chain}_0.01` }, { text: '0.05', callback_data: `${action}_${address}_${chain}_0.05` }, { text: '0.1', callback_data: `${action}_${address}_${chain}_0.1` }],
                                    [{ text: '0.5', callback_data: `${action}_${address}_${chain}_0.5` }, { text: '1', callback_data: `${action}_${address}_${chain}_1` }, { text: 'Custom', callback_data: `${action}_${address}_${chain}_99999999` }]
                                ]
                            }
                        }
                    );
                }

                if (action === 'sell') {
                    ctx.reply('Please choose or enter amount to sell',
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '10%', callback_data: `${action}_${address}_${chain}_10` }, { text: '30%', callback_data: `${action}_${address}_${chain}_30` }, { text: '50%', callback_data: `${action}_${address}_${chain}_20` }],
                                    [{ text: '75%', callback_data: `${action}_${address}_${chain}_75` }, { text: '90%', callback_data: `${action}_${address}_${chain}_1` }, { text: 'All', callback_data: `${action}_${address}_${chain}_100` }]
                                ]
                            }
                        }
                    );
                }
            } catch (error) {
                console.log(error);
                ctx.reply('Failed to process your request. Please try again later');
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Xử lý sự kiện khi người dùng chọn một số tiền để trade
        this.bot.action(/(buy|sell)_(\w+)_(\w+)_(\d+(\.\d+)?)/, async (ctx: any) => {
            try {
                const action = ctx.match[1];
                const address = ctx.match[2];
                const chain = ctx.match[3];
                const amount = ctx.match[4];
                if (amount === '99999999') {
                    await ctx.reply('Please enter amount to trade');
                    ctx.session = {
                        data: {
                            address, chain, type: action
                        },
                        action: 'verifyTrade',
                        step: 'amount',
                    }
                    return;
                } else {
                    await this.verifyTrade(ctx, { amount, address, chain, type: action });
                }
            } catch (error) {
                console.log(error);
                ctx.reply('Failed to process your request. Please try again later');
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Xử lý text người dùng nhập vào
        this.bot.hears(/.+/, async (ctx: any) => {
            try {
                const text = ctx.message.text;

                // kiểm tra đầu vào theo regex
                const addressRegex = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}|T[1-9A-HJ-NP-Za-km-z]{33})$/;
                if (addressRegex.test(text)) {
                    await this.infoToken(ctx);
                    return;
                }

                // kiểm tra đầu vào otp
                const otpRegex = /^\d{6}$/;
                if (ctx.session && ctx.session.step === 'otp' && otpRegex.test(text)) {
                    if (ctx.session.action === "trade") {
                        const { address, amount, chain, type } = ctx.session.data;
                        await this.trade(ctx, { amount, address, chain, type, otp: text });
                        return;
                    }
                }

                const amountRegex = /^\d+(\.\d+)?$/;
                if (amountRegex.test(text) && ctx.session && ctx.session.step === 'amount' && ctx.session.action === 'verifyTrade') {
                    const { address, chain, type } = ctx.session.data;
                    await this.verifyTrade(ctx, { amount: text, address, chain, type });
                    return;
                }

                await ctx.reply('Invalid command, please try again');
            } catch (error) {
                console.log(error);
                await ctx.reply('Failed to process your request. Please try again later');
            }
        });

        // Xử lý sự kiện khi người dùng chọn một token để xem thông tin analysis_address
        this.bot.action(/analysis:(\w+)/, async (ctx) => {
            try {
                const address = ctx.match[1];
                const analysisResult = await this.analyzeToken(address);
                await ctx.reply(analysisResult.join('\n'), { parse_mode: "Markdown" });
            } catch (error) {
                console.log(error);
                ctx.reply('Failed to analyze token. Please try again later');
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Xử lý sự kiện khi người dùng chọn một chain
        this.bot.action(/createWallet:(\w+)/, async (ctx) => {
            try {
                const walletType = ctx.match[1];
                if (walletType !== 'evm') {
                    ctx.reply('Not support chain, please try again later');
                    return;
                }
                await this.createwallet(ctx, walletType);
            } catch (error) {
                console.log(error);
                ctx.reply('Failed to create wallet. Please try again later');
            } finally {
                await ctx.answerCbQuery();
            }
        });

        // Cấu hình Webhook
        // this.bot.telegram.deleteWebhook();
        // this.bot.telegram.setWebhook('https://caring-aardvark-viable.ngrok-free.app/tg/webhook');
        this.bot.launch();
    }

    private formatTokenAmount(amount: any, decimals: any, symbol: any = ''): string {
        // Chuyển đổi BigInt thành chuỗi thập phân
        const formattedAmount = ethers.formatUnits(amount, decimals);

        // Chia chuỗi thành phần nguyên và phần thập phân
        let [integerPart, decimalPart] = formattedAmount.split(".");

        // Định dạng phần nguyên với dấu phẩy phân cách hàng nghìn
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        // Nếu phần thập phân tồn tại, cắt nó theo số lượng chữ số thập phân cần hiển thị
        if (decimalPart && decimals > 0) {
            decimalPart = decimalPart.slice(0, decimals.toString());
            return `${integerPart}.${decimalPart} ${symbol ? symbol : ''}`;
        } else {
            return `${integerPart} ${symbol ? symbol : ''}`;
        }
    }

    async infoToken(ctx: any) {
        const address = ctx.message.text;

        await ctx.reply('⏳ Checking token information...');
        // call API token info
        // const tokenInforResult = await axios.get(`${this.getApiPath()}/analyze/info/${address}`);

        // call API token info
        let tokenInforResult = await axios.get(`${this.getApiPath()}/token/${address}`);

        if (!tokenInforResult || !tokenInforResult.data) {
            await ctx.reply('Token not found');
            return;
        }
        if (tokenInforResult.data.data === null) {
            tokenInforResult = await axios.get(`${this.getApiPath()}/analyze/token/${address}`);
        }

        if (!tokenInforResult || !tokenInforResult.data || tokenInforResult.data.data === null) {
            await ctx.reply('Token not found');
            return;
        }

        if (!tokenInforResult.data.success) {
            await ctx.reply(tokenInforResult.data.message);
            return;
        }

        const token = tokenInforResult.data.data;
        const tokenMessage = ['*Token Information*'];

        if (token.name) {
            tokenMessage.push(`🔹 Name: [${token.name} - ${token.symbol}](${getTokenExplorerUrl(token.chain, token.address)})`);
        }

        if (token.totalSupply) {
            tokenMessage.push(`🔹 Total Supply: ${this.formatTokenAmount(token.totalSupply, token.decimals)}`);
        }

        if (token.owner) {
            tokenMessage.push(`🔹 Owner: [${token.owner}](${getAddressExplorerUrl(token.chain, token.owner)})`);
        }

        tokenMessage.push(`🔹 Holders: ${token.holders} | 🔹 Decimals: ${token.decimals} | 🔹 Fee: ${token.fee}`);

        tokenMessage.push(`*\nPool Info*`);
        if (token.liquidity) {
            tokenMessage.push(`💧 Liq: ${typeof token.liquidity === 'string' ? token.liquidity : token.liquidity?.info}`);
            if (token.liquidity?.locked !== undefined) {
                tokenMessage.push(`🔒 Locked: ${token.liquidity?.locked ? '✅' : '❌'} ${token.chain === 'ether' || token.chain === 'base' || token.chain === 'etherum' ? ` | 🔗 [View on Unicrypt](https://app.uncx.network/amm/uni-v2/token/${token.address})` : ``}`);
            } else {
                tokenMessage.push(`🔒 Locked: N/A`);
            }
        } else {
            tokenMessage.push(`💧 Liq: N/A`);
        }
        if (token.exchange) {
            tokenMessage.push(`🏦 Exchange: [${typeof token.exchange === 'string' ? token.exchange : token.exchange?.name}](${token.exchange?.url})`);
        } else {
            tokenMessage.push(`🏦 Exchange: N/A`);
        }

        //team
        if (token.team !== undefined && token.team !== null && token.team.wallet) {
            tokenMessage.push(`*\nTeam Info*`);
            const teamItems = [];

            if (token.team.wallet) {
                teamItems.push(`Wallet: [${token.team.wallet}](${getAddressExplorerUrl(token.chain, token.team.wallet)})`);
            }

            if (teamItems.length > 0) {
                tokenMessage.push(`🔹 ${teamItems.join(' | ')}`);
            }
        }

        if (token.audit !== undefined) {
            tokenMessage.push(`*\nAudit Info*`);
            const auditItems = [];

            if (token.audit.is_contract_renounced !== undefined && token.audit.is_contract_renounced !== null) {
                const ownershipEmoji = token.audit.is_contract_renounced ? '✅' : '❌';
                auditItems.push(`Ownership Renounced: ${ownershipEmoji}`);
            } else {
                auditItems.push(`Ownership Renounced: N/A`);
            }

            if (token.audit.codeVerified !== null && token.audit.codeVerified !== undefined) {
                const codeVerifiedEmoji = token.audit.codeVerified ? '✅' : '❌';
                auditItems.push(`Code Verified: ${codeVerifiedEmoji}`);
            } else {
                auditItems.push(`Code Verified: N/A`);
            }

            if (token.audit.lockTransactions !== null && token.audit.lockTransactions !== undefined) {
                const lockTransactionsEmoji = token.audit.lockTransactions ? '✅' : '❌';
                auditItems.push(`Lock Transactions: ${lockTransactionsEmoji}`);
            } else {
                auditItems.push(`Lock Transactions: N/A`);
            }

            if (token.audit.mintable !== null && token.audit.mintable !== undefined) {
                const mintableEmoji = token.audit.mintable ? '✅' : '❌';
                auditItems.push(`Mintable: ${mintableEmoji}`);
            } else {
                auditItems.push(`Mintable: N/A`);
            }

            if (token.audit.proxy !== undefined && token.audit.proxy !== null) {
                const proxyEmoji = token.audit.proxy ? '✅' : '❌';
                auditItems.push(`Proxy: ${proxyEmoji}`);
            } else {
                auditItems.push(`Proxy: N/A`);
            }

            if (token.audit.unlimitedFees !== null && token.audit.unlimitedFees !== undefined) {
                const unlimitedFeesEmoji = token.audit.unlimitedFees ? '✅' : '❌';
                auditItems.push(`Unlimited Fees: ${unlimitedFeesEmoji}`);
            } else {
                auditItems.push(`Unlimited Fees: N/A`);
            }

            // Kết hợp 2 item thành 1 dòng
            if (auditItems.length > 0) {
                for (let i = 0; i < auditItems.length; i += 2) {
                    const item1 = auditItems[i];
                    const item2 = auditItems[i + 1] ? auditItems[i + 1] : '';
                    tokenMessage.push(`🔹 ${item1} | ${item2}`);
                }
            }
        }

        // info social
        if (token.tokenInfo !== undefined) {
            tokenMessage.push(`*\nSocial Info*`);
            const tokenLinks = [];

            if (token.tokenInfo.website) {
                tokenLinks.push(`[Website](${token.tokenInfo.website})`);
            }

            if (token.tokenInfo.twitter) {
                tokenLinks.push(`[Twitter](${token.tokenInfo.twitter})`);
            }

            if (token.tokenInfo.telegram) {
                tokenLinks.push(`[Telegram](${token.tokenInfo.telegram})`);
            }

            if (token.tokenInfo.logo) {
                tokenLinks.push(`[Logo](${token.tokenInfo.logo})`);
            }

            if (tokenLinks.length > 0) {
                tokenMessage.push(`🌐 *Links:* ${tokenLinks.join(' | ')}`);
            }
        }

        // Add inline buttons
        await ctx.reply(tokenMessage.join('\n'), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🟢 Buy', callback_data: `buy:${address}:${token.chain}` },
                        { text: '🔴 Sell', callback_data: `sell:${address}:${token.chain}` },
                    ],
                    [
                        { text: '📈 Chart', url: `https://www.dextools.io/app/en/tron/pair-explorer/${token.liquidity?.pair_id}` },
                        // onchain analysis
                        { text: '🔍 Onchain', callback_data: `analysis:${address}` },
                    ],
                    [
                        // My balance
                        { text: '💰 My Balance', callback_data: `balances:${token.chain}:${ethers.getAddress(token.address)}` },
                    ]
                ]
            }
        });
    }

    async analyzeToken(address: string): Promise<string[]> {

        const tokenInforResult = await axios.get(`${this.getApiPath()}/analyze/token/${address}`);

        if (!tokenInforResult || !tokenInforResult.data) {
            return ['Token not found'];
        }

        if (!tokenInforResult.data.success) {
            return [tokenInforResult.data.message];
        }

        const token = tokenInforResult.data.data;
        const tokenMessage = [];

        if (token.name) {
            tokenMessage.push(`🏷️ *Name:* [${token.name}](${token.addressLink})`);
        }
        if (token.symbol) {
            tokenMessage.push(`💠 *Symbol:* ${token.symbol}`);
        }
        if (token.totalSupply) {
            tokenMessage.push(`🔢 *Total Supply:* ${token.totalSupply}`);
        }
        if (token.liquidity) {
            tokenMessage.push(`💧 *Liquidity:*`);
            const lockedEmoji = token.liquidity.locked ? '✅' : '❌';
            tokenMessage.push(`            \t- Locked: ${lockedEmoji}`);
            if (token.liquidity.info) {
                tokenMessage.push(`            \t- Info: ${token.liquidity.info}`);
            }
            if (token.liquidity.lockUrl) {
                tokenMessage.push(`            \t- Link: [View on Unicrypt](${token.liquidity.lockUrl})`);
            }

            if (token.liquidity.unlockTime) {
                tokenMessage.push(`            \t- Unlock Time: ${token.liquidity.unlockTime}`);
            }

            if (token.liquidity.lockedBalance) {
                tokenMessage.push(`            \t- Locked Balance: ${token.liquidity.lockedBalance}`);
            }
        }
        if (token.owner) {
            tokenMessage.push(`👤 *Owner:* [${token.owner}](${token.ownerLink})`);
        }
        if (token.hasRenouncedOwnership !== undefined) {
            const ownershipEmoji = token.hasRenouncedOwnership ? '✅' : '❌';
            tokenMessage.push(`❗ *Ownership Renounced:* ${ownershipEmoji}`);
        }
        // if (token.creationBlockUrl) {
        //     tokenMessage.push(`📦 *Creation Block:* [${token.creationBlock}](${token.creationBlockUrl})`);
        // }
        // if (token.creationLink) {
        //     tokenMessage.push(`🔗 *Creation Tx:* [View on Explorer](${token.creationLink})`);
        // }

        if (token.firstBuyers && token.firstBuyers.length > 0) {
            tokenMessage.push(`\n🛒 *First Buyers:*`);
            token.firstBuyers.forEach((buyer, index) => {
                tokenMessage.push(`🟢 Buyer: [${buyer.to.slice(-6)}](${buyer.toUrl}) - 💰 Amount: *${buyer.amount}* - 🧱 [${buyer.blockNumber}](${buyer.blockNumberUrl}) - [Tx](${buyer.txUrl}) - 💸 Remaining: *${buyer.remainingAmount}*`);
            });
        }

        if (token.firstMinters && token.firstMinters.length > 0) {
            tokenMessage.push(`\n🏭 *First Minters:*`);
            token.firstMinters.forEach((minter, index) => {
                tokenMessage.push(`🔵 Minter: [${minter.to.slice(-6)}](${minter.toUrl}) - 💰 Amount: *${minter.amount}* - 🧱 [${minter.blockNumber}](${minter.blockNumberUrl}) - [Tx](${minter.txUrl}) - 💸 Remaining: *${minter.remainingAmount}*`);
            });
        }
        return tokenMessage;
    }

    async faucet(address: string) {
        const apiResult = await axios.post(process.env.BASE_ADMIN_RPC_URL, { "method": "tenderly_addBalance", "params": [[address], "0x3635c9adc5dea00000"], "id": 42, "jsonrpc": "2.0" });
        if (!apiResult || !apiResult.data) {
            return false;
        }
        const ethFaucetResult = await axios.post(process.env.ETHEREUM_ADMIN_RPC_URL, { "method": "tenderly_addBalance", "params": [[address], "0x3635c9adc5dea00000"], "id": 42, "jsonrpc": "2.0" });
        return `Base tx: ${apiResult.data.result}, ETH tx ${ethFaucetResult.data.result}`;
    }

    async sendMessage(chatId: number, text: string) {
        await this.bot.telegram.sendMessage(chatId, text);
    }

    getBot() {
        return this.bot;
    }

    // Kiểm tra ví và yêu cầu nhập otp để trade
    async verifyTrade(ctx: any, data: { amount: string, address: string, chain: string, type: string }) {
        const userId = ctx.from.id;
        const walletType = Chains.find(x => x.name.toLowerCase() === data.chain.toLowerCase())?.walletType;
        if (!walletType) {
            ctx.reply('Invalid chain');
            this.removeSession(ctx);
            return;
        }
        if (!await this.exitsWallet(userId, walletType)) {
            ctx.reply('You need to create wallet first');
            this.removeSession(ctx);
            return;
        }
        // request client type otp for buy
        ctx.reply(`Please enter OTP to ${data.type} ${data.amount}${data.type === 'sell' ? '%' : ' ETH'} ${data.address}`);
        ctx.session = {
            data: {
                userId,
                ...data
            },
            action: "trade",
            step: 'otp',
        };
        // check otp
    }

    // Xử lý sự kiện khi người dùng chọn xem balance
    async handleBalanceRequest(ctx) {
        try {
            const walletTypes = [
                { name: 'ether', label: 'Ethereum', emoji: '🦄' },
                { name: 'base', label: 'Base', emoji: '🛡️' },
                { name: 'solana', label: 'Solana', emoji: '⚡' },
                { name: 'ton', label: 'TON', emoji: '💎' },
            ];

            // Check if wallets exist for each type
            const walletExistence = await Promise.all(
                walletTypes.map(type => this.exitsWallet(ctx.from.id, Chains.find(c => c.name === type.name)?.walletType))
            );
            // Construct the inline keyboard dynamically with 2 buttons per row
            const inlineKeyboard = [];
            for (let i = 0; i < walletTypes.length; i += 2) {
                const row = [];
                walletTypes.slice(i, i + 2).filter((type, index) => {
                    if (walletExistence[i + index]) {
                        row.push({ text: `${type.emoji} View Balances ${type.label}`, callback_data: `balances:${type.name}` });
                    }
                });
                if (row.length > 0) {
                    inlineKeyboard.push(row);
                }
            }
            if (inlineKeyboard.length === 0) {
                await ctx.reply('You need to create wallet first');
                return;
            }
            // Reply with the constructed inline keyboard
            await ctx.reply(
                'Please choose a chain:',
                {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                }
            );
        } catch (error) {
            console.error('Error checking balance:', error);
        }
    };

    // Thực hiện trade
    async trade(ctx: any, data: { amount: string, address: string, chain: string, type: string, otp: string }) {
        try {
            const userId = ctx.from.id;
            const walletType = Chains.find(x => x.name.toLowerCase() === data.chain.toLowerCase())?.walletType;
            if (!walletType) {
                await ctx.reply('Invalid chain');
                return;
            }
            if (!await this.exitsWallet(userId, walletType)) {
                await ctx.reply('You need to create wallet first');
                return;
            }
            await ctx.reply('⏳ Cooking...');
            // call api trade
            const apiResult = await axios.post(`${this.getApiPath()}/trade/${userId}/${data.chain}`, {
                address: ethers.getAddress(data.address),
                amount: data.amount,
                type: data.type
            }, {
                headers: {
                    'x-otp': data.otp
                }
            });
            if (!apiResult || !apiResult.data) {
                await ctx.reply('Failed to trade');
                return;
            }
            if (!apiResult.data.success) {
                await ctx.reply(apiResult.data.message);
                return;
            }
            await ctx.reply(`Trade success: [tx](${getExplorerUrl(data.chain, apiResult.data.data)})`, { parse_mode: 'Markdown' });
        } finally {
            this.removeSession(ctx);
        }
    }

    async removeSession(ctx) {
        ctx.session = null;
        await this.redisService.del(`session:${ctx.from?.id}`);
    }
    // Kiểm tra xem một user đã có wallet chưa
    async exitsWallet(userId: number, walletType: string) {
        const apiResult = await axios.get(`${this.getApiPath()}/wallet/exits/${userId}?type=${walletType}`);
        if (!apiResult || !apiResult.data) {
            return false;
        }
        return apiResult.data.data;
    }

    getApiPath() {
        return process.env.API_PATH || 'http://localhost:8222';
    }

    async handlerCreateWallet(ctx: any) {
        try {
            const walletTypes = [
                { name: 'evm', label: 'Ethereum', emoji: '🦄' },
                { name: 'solana', label: 'Solana', emoji: '⚡' },
                { name: 'ton', label: 'TON', emoji: '💎' },
            ];

            // Check if wallets exist for each type
            const walletExistence = await Promise.all(
                walletTypes.map(type => this.exitsWallet(ctx.from.id, type.name))
            );

            // Construct the inline keyboard dynamically with 2 buttons per row
            const inlineKeyboard = [];
            for (let i = 0; i < walletTypes.length; i += 2) {
                const row = walletTypes.slice(i, i + 2).map((type, index) => {
                    const action = walletExistence[i + index] ? `view:wallet:` : `createWallet:`;
                    return { text: `${type.emoji} ${walletExistence[i + index] ? 'View' : ''} ${type.label}`, callback_data: `${action}${type.name}` };
                });
                inlineKeyboard.push(row);
            }
            // Reply with the constructed inline keyboard
            await ctx.reply(
                'Please choose a chain:',
                {
                    reply_markup: {
                        inline_keyboard: inlineKeyboard,
                    },
                }
            );
        } catch (error) {
            console.error('Error creating wallet:', error);
        }
    }
    // Tạo mới wallet cho user
    async createwallet(ctx: any, walletType: string) {
        const userId = ctx.from.id;
        // call axio api
        const apiResult = await axios.get(`${this.getApiPath()}/wallet/create/${userId}?type=${walletType}`);
        if (!apiResult || !apiResult.data) {
            ctx.reply('Failed to create wallet');
            return;
        }
        if (!apiResult.data.success) {
            ctx.reply(apiResult.data.message);
            return;
        }
        const wallet = apiResult.data.data;
        const walletMessage = [];
        if (wallet.address) {
            walletMessage.push(`Your wallet address:\n*\`${wallet.address}\`*`);
        }
        if (wallet.privateKey) {
            walletMessage.push(`Your private key:\n*||${wallet.privateKey}||*`);
        }
        if (wallet.mnemonic) {
            walletMessage.push(`Your mnemonic:\n*||${wallet.mnemonic}||*`);
        }

        await ctx.reply(`${walletMessage.join('\n')}\n\n*Please backup it carefully\\!*`, { parse_mode: 'MarkdownV2' });
        if (wallet.otpSecret) {
            const otpAuthUrl = speakeasy.otpauthURL({
                secret: wallet.otpSecret,
                label: `BULLFARM:${userId}`,  // Set the name (label) to be displayed in the authenticator app
                issuer: 'BullFarm',  // Set the issuer to your application's name
                encoding: 'base32',
            });
            const qrImage = await qrcode.toBuffer(otpAuthUrl);
            const photoChat = await ctx.replyWithPhoto({ source: qrImage }, { caption: `Your OTP Serect:\n*\`${wallet.otpSecret}\`* \nOr\nScan this QR code to set up your OTP\n\n*Message will auto delete after 5 minutes*`, parse_mode: 'MarkdownV2' });
            setTimeout(async () => {
                await ctx.telegram.deleteMessage(photoChat.chat.id, photoChat.message_id);
            }, 300000);
        }

        //faucet evm
        if (walletType === 'evm') {
            const txId = await this.faucet(wallet.address);
            ctx.reply(`Faucet 1000 ETH success: ${txId}`);
        }
    }
}
