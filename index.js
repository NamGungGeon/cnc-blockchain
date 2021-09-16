const { Blockchain, Transaction } = require("./blockchain");
const { generateKey } = require("./keygen");

const myKeyBundle = generateKey();
const [myPublicKey, myPrivateKey, myKeyPair] = myKeyBundle;

//test
const testCoin = new Blockchain();

//myPublicKey-> Jane에게 10코인만큼 전송
const tx1 = new Transaction(myPublicKey, "Jane", 10);
//해당 트랜잭션에 소유자의 키페어로 사인한다
tx1.signTransaction(myKeyPair);
//사인된 트랜잭션을 블록체인에 제출
testCoin.addTransaction(tx1);
console.log("\nsend 10 coin from myPublicKey to Jane");

console.log(
  `\n(before mining)balance of Jane is `,
  testCoin.getBalanceOfAddress("Jane")
);

//채굴 시작
console.log("\nstarting mining...");
testCoin.minePendingTransactions("Jane");

console.log(
  `\n(after mining)balance of Jane is `,
  testCoin.getBalanceOfAddress("Jane")
);

console.log("\nchain is valid?", testCoin.isValid());
console.log("\nmanipulate transaction!!");
testCoin.chain[1].transactions[0].amount = 1000;
console.log("chain is valid?", testCoin.isValid());
