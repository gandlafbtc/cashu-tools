import type { Proof } from "@gandlaf21/cashu-ts";
const getAmountForTokenSet = (proofs: Array<Proof>): number => {
    return proofs.reduce((acc, p) => { return acc + p.amount }, 0)
}

export {getAmountForTokenSet}