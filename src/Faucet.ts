import { CashuWallet, Proof } from "@gandlaf21/cashu-ts"
import { getAmountForTokenSet } from "./utils"

export class Faucet {
    balance = Array<Proof>()
    currentToken = Array<Proof>()
    intervalMS: number
    amountSatoshi: number
    lastWithdraw: Date
    message: string
    wallet: CashuWallet
    isClaimed = true
    
    constructor(cashuWallet: CashuWallet, intervalMS: number, amountSatoshi:number) {
        this.wallet = cashuWallet
        this.intervalMS = intervalMS
        this.amountSatoshi = amountSatoshi
        this.lastWithdraw = new Date()
    }

    start = async () => {
        console.log("starting faucet")
        this.cycleNewToken()
        setInterval(this.cycleNewToken, this.intervalMS)
        setInterval(this.checkClaimed, 5000)
        
    }

    checkClaimed = async () => {
        try {
            if(!this.currentToken){
                console.log('no current token')
                return
            }
            const spentProofs = await this.wallet.checkProofsSpent(this.currentToken)
            if (spentProofs.length>0) {
                console.log('token was claimed')
                this.isClaimed = true
                this.lastWithdraw = new Date()  
                this.currentToken = []            
            }
        } catch (error) {
            console.log(error)
        }

    }


    cycleNewToken = async () => {
        if(!this.isClaimed) {
            return
        }
        console.log('Trying to cycle new token')


        const proofsToSend = Array<Proof>()
        this.balance.forEach(proof => {
            if (getAmountForTokenSet(proofsToSend) >= this.amountSatoshi) {
                // add excess proofs here?
                return
            }
            proofsToSend.push(proof)
        });
        if (this.amountSatoshi > getAmountForTokenSet(proofsToSend)) {
            console.log('not enough funds in faucet. charge with /charge?token={token}')
            this.message = 'the faucet has runneth dry'
            return
        }
        try {
            this.balance = this.balance.filter(t=> !proofsToSend.includes(t))
            const {returnChange,send} = await this.wallet.send(this.amountSatoshi, proofsToSend)
            this.balance.push(...returnChange)
            this.currentToken = send
            this.isClaimed = false
        }
        catch (e) {
            console.error(e)
        }
    }

    charge = async (token: string) =>  {
        try {
            if (!token) {
                return 'could not charge. No cashu token provided'
            }

            console.log("charging the faucet...")
            const receivedTokens = await this.wallet.receive(token)
            this.balance.push(...receivedTokens)
            console.log("faucet charged")
            return 'Success: faucet charged with '+ getAmountForTokenSet(receivedTokens) + "sats"
        } catch (error) {
            console.error(error)
            return 'could not charge. ' + error.response.data.detail
        }
    }
}