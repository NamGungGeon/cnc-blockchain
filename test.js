const { Blockchain, Transaction } = require("./blockchain");
const { generateKey, keys } = require("./keygen");
const fs = require("fs");
const wallets = require("./wallets");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

//start test
const cncCoin = new Blockchain();
const [k1Public, k1Private, k1Key] = generateKey();
const [k2Public, k2Private, k2Key] = generateKey();

const exec = async () => {
  const tx = await Transaction.withDataUpload(
    k1Public,
    wallets.receptionist,
    fs.readFileSync("package.json")
  );
  tx.signTransaction(k1Key);
  cncCoin.addTransaction(tx);
  const tx2 = await Transaction.withDataUpload(
    k2Public,
    wallets.receptionist,
    fs.readFileSync("package.json")
  );
  tx2.signTransaction(k2Key);

  //throw exception
  //other person hash pacakge.json's ownership
  cncCoin.addTransaction(tx2);

  console.log(cncCoin.pendingTransactions);
};
exec();
