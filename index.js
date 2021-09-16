const { Blockchain, Transaction } = require("./blockchain");
const { generateKey } = require("./keygen");
const fs = require("fs");

const wallets = require("./known-wallet");

const myKeyBundle = generateKey("my");
const [myPublicKey, myPrivateKey, myKeyPair] = myKeyBundle;

//test
const testCoin = new Blockchain();

//myPublicKey가 파일 내용을 블록체인에 업로드
const fileContent = fs.readFileSync("./package.json");
const tx1 = new Transaction(myPublicKey, wallets.receptionist, 0, fileContent);
//해당 트랜잭션에 소유자의 키페어로 사인한다
tx1.signTransaction(myKeyPair);
//사인된 트랜잭션을 블록체인에 제출
testCoin.addTransaction(tx1);
console.log("\nmyPulicKey add transaction with file");

//채굴 시작
console.log("\nstarting mining...");
testCoin.minePendingTransactions(myPublicKey);
console.log("\nend mining...");

console.log(
  `\n(after mining)balance of myPublickey is `,
  testCoin.getBalanceOfAddress(myPublicKey)
);
