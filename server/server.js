 const { CashuMint, CashuWallet, getEncodedProofs } = require("@gandlaf21/cashu-ts")
const { Faucet } = require ("../dist/lib/es5/Faucet")

const express = require('express')
const app = express()
const port = 3000

const mintURL  = 'https://legend.lnbits.com/cashu/api/v1/4gr9Xcmz3XEkUNwiBiQGoC'

let faucet


app.get('/', (req, res) => {
    let responseString ="Token has already been claimed! waiting for next token..."
    if(faucet.currentToken.length>0){
         responseString = 
        getEncodedProofs(faucet.currentToken ,[{url:mintURL, keysets: [...new Set(faucet.currentToken.map(t=>t.id))]}])
    }
  res.send({token: responseString})
})

app.get('/charge', async (req, res) => {
    const token = req.query.token
    const message  = await faucet.charge(token)
    res.send({message})
  })

app.listen(port, async () => {
    const cashuMint = new CashuMint(mintURL)
    const keys  = await cashuMint.getKeys()
    const cashuWallet = new CashuWallet(keys, cashuMint)
    faucet = new Faucet(cashuWallet, 10000, 1)
    await faucet.start()

  console.log(`Example app listening on port ${port}`)
})

