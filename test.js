const { Blockchain, Transaction } = require("./blockchain");
const { generateKey, keys } = require("./keygen");
const fs = require("fs");
const wallets = require("./wallets");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");

//start test
const cncCoin = new Blockchain();
const [k1Public, k1Private, k1Key] = generateKey();
const [k2Public, k2Private, k2Key] = generateKey();

const exec = async () => {
  const tx = await Transaction.createTxWithNFT(
    k1Public,
    wallets.receptionist,
    fs.readFileSync("package.json")
  );
  tx.signTransaction(k1Key);
  cncCoin.addTransaction(tx);
  console.log(cncCoin.pendingTransactions);
  cncCoin.minePendingTransactions(k1Public);

  const tx2 = await Transaction.createTxWithNFT(
    k2Public,
    k1Public,
    fs.readFileSync("package.json")
  );
  tx2.signTransaction(k2Key);

  //throw exception
  //other person hash pacakge.json's ownership
  cncCoin.addTransaction(tx2);

  console.log(cncCoin.pendingTransactions);
  console.log(cncCoin.chain);

  const nft = crypto
    .createHash("sha256")
    .update(fs.readFileSync("package.json"))
    .digest("hex");
  console.log(`${nft} owner is `, cncCoin.findNFTOwner(nft));
};
exec();
