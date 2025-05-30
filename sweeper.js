const Web3 = require('web3').Web3;

const INFURA_URL = process.env.INFURA_URL;
const web3 = new Web3(INFURA_URL);

const destination = process.env.TRUST_WALLET;
const privateKeys = JSON.parse(process.env.PRIVATE_KEYS);

const tokens = [
  {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6
  },
  {
    symbol: 'DAI',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18
  }
];

const tokenABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "success", type: "bool" }],
    type: "function"
  }
];

async function sweepETH(account) {
  const balance = await web3.eth.getBalance(account.address);
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = 21000;
  const value = BigInt(balance) - (BigInt(gasPrice) * BigInt(gasLimit));

  if (value > 0n) {
    const tx = {
      from: account.address,
      to: destination,
      value: value.toString(),
      gas: gasLimit,
      gasPrice,
    };

    const receipt = await web3.eth.sendTransaction(tx);
    console.log(`✅ Swept ETH from ${account.address}: ${receipt.transactionHash}`);
  } else {
    console.log(`⛔ No ETH to sweep from ${account.address}`);
  }
}

async function sweepTokens(account) {
  for (const token of tokens) {
    const contract = new web3.eth.Contract(tokenABI, token.address);
    const rawBalance = await contract.methods.balanceOf(account.address).call();

    if (rawBalance > 0) {
      const tx = contract.methods.transfer(destination, rawBalance);
      const gas = await tx.estimateGas({ from: account.address });
      const gasPrice = await web3.eth.getGasPrice();

      const data = tx.encodeABI();
      const txObj = {
        from: account.address,
        to: token.address,
        data,
        gas,
        gasPrice,
      };

      try {
        const signed = await web3.eth.accounts.signTransaction(txObj, account.privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        console.log(`✅ Swept ${token.symbol} from ${account.address}: ${receipt.transactionHash}`);
      } catch (err) {
        console.error(`⛔ Failed to sweep ${token.symbol} from ${account.address}: ${err.message}`);
      }
    } else {
      console.log(`⛔ No ${token.symbol} to sweep from ${account.address}`);
    }
  }
}

async function sweepWallet(privateKey) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);

  await sweepETH(account);
  await sweepTokens(account);
}

async function startSweeping() {
  for (const pk of privateKeys) {
    await sweepWallet(pk);
  }
}

setInterval(startSweeping, 30 * 1000); // Every 30 seconds
