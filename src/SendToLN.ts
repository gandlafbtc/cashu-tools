import { CashuMint, CashuWallet, getDecodedProofs, Proof } from '@gandlaf21/cashu-ts';
import { requestInvoice } from 'lnurl-pay';

export type Donation = {
    wallet: CashuWallet,
    invoice: string,
    proofs: Array<Proof>,
    fees: number
}

type Status = {
    isSuccess: boolean,
    preimages?: Array<string>,
    errors?: Array<string>
}

/**
 * Takes a cashu V2 token and melts them at the given mint
 * @param token Cashu V2 Token
 * @param lnaddress 
 */
export async function sendToLn(token: string, lnaddress: string) {
    const donations: Array<Donation> = await validateToken(token, lnaddress)
    const status: Status = await sendDonations(donations)
    return status
}

export const sendDonations = async (cashuDonos: Array<Donation>): Promise<Status> => {
    const failedMints: Array<string> = [];
    const preimages: Array<string> = [];
    for (const dono of cashuDonos) {
        try {
            const { isPaid, preimage } = await dono.wallet.payLnInvoice(dono.invoice, dono.proofs);
            if (!isPaid) {
                failedMints.push(dono.wallet.mint.mintUrl);
            }
            else {
                preimages.push(preimage)
            }
        } catch (e) {
            console.log(e);
            failedMints.push(dono.wallet.mint.mintUrl);
        }
    }
    if (failedMints.length < 1) {
        return { isSuccess: false, errors: failedMints.map(url => "Error: invoice at mint " + url + " was not paid") }
    }
    return { isSuccess: true, preimages }
}

export const validateToken = async (token: string, lnaddress: string): Promise<Array<Donation>> => {
    if (!token) {
        return;
    }
    const parsedTokens = getDecodedProofs(token);
    if (!parsedTokens.mints || !parsedTokens.proofs) {
        return;
    }
    const cashuDonos: Array<Donation> = Array<Donation>()
    for (const mint of parsedTokens.mints) {
        const cashuMint = new CashuMint(mint.url);
        try {
            const proofsForMint = parsedTokens.proofs.filter((p) => mint.keysets.includes(p.id));
            if (!proofsForMint) {
                return;
            }
            const keys = await cashuMint.getKeys();
            const cashuWallet = new CashuWallet(keys, cashuMint);
            const spentProofs = await cashuWallet.checkProofsSpent(proofsForMint);
            const unspentProofs = proofsForMint.filter((p) => !spentProofs.includes(p));
            const donoAmount = unspentProofs.reduce((acc, p) => acc + p.amount, 0);
            const { invoice, params, successAction, validatePreimage } = await requestInvoice({
                lnUrlOrAddress: lnaddress,
                // @ts-expect-error idk
                tokens: Math.floor(donoAmount * 0.98) - 1
            });
            // const recomendedFees = await cashuWallet.getFee(invoice);
            const donoFees = Math.floor(donoAmount * 0.02) + 2;
            const donoInvoice = invoice;
            cashuDonos.push({
                wallet: cashuWallet,
                proofs: unspentProofs,
                fees: donoFees,
                invoice: donoInvoice
            });
        } catch (e) {
            console.error(e);
        }
    }
    return cashuDonos
}
