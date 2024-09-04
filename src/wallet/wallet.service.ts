import { Injectable } from '@nestjs/common';
import * as solanaWeb3 from '@solana/web3.js';
import { Contract, ethers } from 'ethers';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { encrypt } from '../utils/cryptoUtils';
import * as speakeasy from 'speakeasy';
import { UserService } from '../user/user.service';
import { Wallet } from './wallet.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/user.schema';
import { getProvider } from '../utils/evmUtils';

@Injectable()
export class WalletService {
    constructor(
        private readonly userService: UserService,
        @InjectModel('wallets') private model: Model<Wallet>
    ) { }

    async getWallet(userId: number, walletType: 'solana' | 'evm' | 'ton'): Promise<Wallet> {
        return await this.model.findOne({ userId, type: walletType });
    }

    /**
     * Kiểm tra xem một user đã có wallet chưa
     * @param userId 
     * @param walletType 
     * @returns 
     */
    async exitsWallet(userId: number, walletType: 'solana' | 'evm' | 'ton'): Promise<boolean> {
        return await this.model.exists({ userId, type: walletType }) ? true : false;
    }

    /**
     * Tạo một wallet mới cho user
     * @param userId 
     * @param walletType 
     * @returns 
     */
    async createWallet(userId: number, walletType: 'solana' | 'evm' | 'ton'): Promise<{ address: string; privateKey: string; mnemonic?: string, otpSecret: string }> {
        let address: string = '';
        let privateKey: string = '';
        let mnemonic: string = '';
        switch (walletType) {
            case 'solana': {
                const keypair = solanaWeb3.Keypair.generate();
                address = keypair.publicKey.toBase58();
                privateKey = Buffer.from(keypair.secretKey).toString('hex');
                break;
            }
            case 'evm': {
                const wallet = ethers.Wallet.createRandom();
                address = wallet.address;
                privateKey = wallet.privateKey;
                break;
            }
            case 'ton': {
                // Generate a new 24-word mnemonic
                const newMnemonic = await mnemonicNew();

                // Convert mnemonic to wallet key
                const key = await mnemonicToWalletKey(newMnemonic);

                // Create a new wallet contract
                const wallet = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });

                mnemonic = newMnemonic.join(" ");
                address = wallet.address.toString({ bounceable: false, testOnly: false, urlSafe: true });
                break;
            }
            default: {
                throw new Error('Invalid wallet type');
            }
        }

        let otpSecret = "";
        let user: User;
        if (await this.userService.exitsUser(userId)) {
            user = await this.userService.getUser(userId);
        } else {
            // Generate OTP secret and code
            otpSecret = speakeasy.generateSecret({
                length: 20
            }).base32;
            user = await this.userService.addUser(userId, otpSecret);
        }

        if (!user) {
            throw new Error('Failed to create user');
        }

        if (await this.model.findOne({ userId: user.userId, type: walletType })) {
            throw new Error('You already have a wallet');
        }
        const wallet = await this.model.create({ userId: user.userId, type: walletType, address, privateKey: privateKey ? encrypt(privateKey) : "", mnemonic: mnemonic ? encrypt(mnemonic) : "", otpSecret });
        if (!wallet) {
            throw new Error('Failed to create wallet');
        }

        return { address, privateKey, mnemonic, otpSecret };
    }

    async getBalance(chain: string, address: string, tokenAddress: string): Promise<{ amount: string, symbol: string, decimals: number, format: string }> {
        switch (chain) {
            case 'ethereum':
            case 'ether':
            case 'optimism':
            case 'base':
            case 'arbitrum':
                break;
            default:
                throw new Error('Invalid chain');
        }
        const provider = getProvider(chain);

        if (!tokenAddress || tokenAddress === "") {
            const amount = await provider.getBalance(address);
            return { amount: amount.toString(), symbol: 'ETH', decimals: 18, format: `${ethers.formatEther(amount)} ETH` };
        }
        const tokenContract = new Contract(tokenAddress, [
            'function balanceOf(address) view returns (uint)',
            'function symbol() view returns (string)',
            'function decimals() view returns (uint8)',
        ], provider);
        const [amount, symbol, decimals] = await Promise.all([tokenContract.balanceOf(address), tokenContract.symbol(), tokenContract.decimals()]);
        return { amount: ethers.formatUnits(amount, decimals), symbol, decimals, format: `${ethers.formatUnits(amount, decimals)} ${symbol}` };
    }
}
