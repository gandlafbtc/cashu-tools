import { CashuMint, CashuWallet, getDecodedToken, getEncodedToken } from '@cashu/cashu-ts';
import { getAmountForTokenSet } from './utils';
import { Token } from '@cashu/cashu-ts/dist/lib/es5/model/types';

class Faucet {
    interval: number;
    amount: number;
    mintWhiteList: string[] = [];

    wallets: CashuWallet[] = [];
    currentToken: Token;

    allTokens: Token = { token: [] };

    constructor(interval: number, amount: number, mintWhitelist: string[] = []) {
        this.amount = amount;
        this.interval = interval;
        this.mintWhiteList = mintWhitelist;
    }

    start() {
        setInterval(() => {
            try {
                this.runInterval();
            } catch (e) {
                console.error('could not run interval', e);
            }
        }, this.interval);
    }

    async runInterval() {
        try {
            const isClaimed = await this.checkCurrentTokenClaimed();
            if (!isClaimed) {
                console.log('token still unclaimed');
                return;
            }
            const nextWallet = this.getNextWallet();
            if (!nextWallet) {
                console.log('not enough balance to schedule new token');
                return;
            }
            this.scheduleNewToken(nextWallet);

        } catch (error) {
            console.log(error)
        }
    }

    async checkCurrentTokenClaimed(): Promise<boolean> {
        try {
            if (this.currentToken === undefined) {
                return true;
            }
            const cashuWallet = this.wallets.find(
                (wallet) => wallet.mint.mintUrl === this.currentToken.token[0].mint
            );
            const spentProofs = await cashuWallet.checkProofsSpent(this.currentToken.token[0].proofs);
            if (spentProofs.length > 0) {
                return true;
            }
            return false;
        } catch (error) {
            console.log(error)
        }
    }

    getNextWallet(): CashuWallet | undefined {
        for (const wallet of this.wallets) {
            const amountInMint = this.allTokens.token
                .filter((t) => t.mint === wallet.mint.mintUrl)
                .map((t) => t.proofs)
                .flat()
                .reduce((acc, curr) => {
                    return acc + curr.amount;
                }, 0);

            if (amountInMint >= this.amount) {
                return wallet;
            }
        }
        return undefined;
    }

    async scheduleNewToken(wallet: CashuWallet) {
        const tokensFromMint = this.allTokens.token.filter((t) => t.mint === wallet.mint.mintUrl);

        const proofsToSend = tokensFromMint.map((t) => t.proofs).flat();

        try {
            const { returnChange, send } = await wallet.send(this.amount, proofsToSend);
            this.allTokens.token = [
                ...this.allTokens.token.filter((t) => !tokensFromMint.includes(t)),
                { proofs: returnChange, mint: wallet.mint.mintUrl }
            ];

            this.currentToken = {
                token: [{ proofs: send, mint: wallet.mint.mintUrl }],
                memo: 'faucet nut deployed'
            };

        } catch (error) {
            console.error(error)
        }
    }

    async charge(encodedToken: string): Promise<string> {
        const token = getDecodedToken(encodedToken);
        try {
            let wallet = this.wallets.find((w) => w.mint.mintUrl === token.token[0].mint);
            if (!wallet) {
                if (this.mintWhiteList.length > 0 && !this.mintWhiteList.includes(token.token[0].mint)) {
                    return `the mint ${token.token[0].mint} is not whitelisted`;
                }
                const cashuMint = new CashuMint(token.token[0].mint);
                const keys = await cashuMint.getKeys();
                wallet = new CashuWallet(keys, cashuMint);
                this.wallets.push(wallet);
            }
            const { proofs } = await wallet.receive(getEncodedToken({ token: [token.token[0]] }));
            this.allTokens.token.push({ proofs, mint: wallet.mint.mintUrl });
            return `faucet charged with ${getAmountForTokenSet(proofs)} sats from mint ${wallet.mint.mintUrl
                }`;

        } catch (error) {
            console.error(error)
        }
    }
}

export { Faucet };
