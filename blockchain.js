const SHA256 = require("crypto-js/sha256");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

//Transaction은 보내는 지갑주소, 받을 지갑주소, 보낸 코인의 양을 포함하는 객체이다
const Transaction = function (fromAddr, toAddr, amount) {
  this.fromAddr = fromAddr;
  this.toAddr = toAddr;
  this.amount = amount;
};
Transaction.prototype.calcHash = function () {
  return SHA256(this.fromAddr + this.toAddr + this.amount).toString();
};
Transaction.prototype.signTransaction = function (signKey) {
  if (signKey.getPublic("hex") !== this.fromAddr) {
    throw "다른 사람의 지갑 정보를 사용하여 트랜잭션에 사인할 수 없습니다";
  }
  const hashTranscation = this.calcHash();
  this.signiture = signKey.sign(hashTranscation, "base64").toDER("hex");
};
Transaction.prototype.isValid = function () {
  //채굴 보상을 수여받는 경우, fromAddr은 null이다
  if (!this.fromAddr) return true;

  if (!this.signiture) {
    throw "서명되지 않은 트랜잭션입니다";
  }

  const publicKey = ec.keyFromPublic(this.fromAddr, "hex");
  return publicKey.verify(this.calcHash(), this.signiture);
};
//Block
//더 이상 index값은 필요하지 않다
//왜냐하면 어차피 블록들은 prevHash<->hash로 각각의 블록 위치가 결정되기 때문이다
const Block = function (timestamp, transactions, prevHash = "") {
  this.timestamp = timestamp;
  this.transactions = transactions;
  this.prevHash = prevHash;
  this.hash = this.calcHash();
  this.nonce = 0;
};
Block.prototype.calcHash = function () {
  //index, prevHash, timestamp, data를 입력으로 해시값을 계산한다
  return SHA256(
    this.prevHash +
      this.timestamp +
      JSON.stringify(this.transactions) +
      this.nonce
  ).toString();
};
//블록 생성
Block.prototype.mining = function (difficulty) {
  const start = new Date();
  //difficulty개의 0으로 시작하는 hash가 발생될 때 까지 해시를 반복한다
  while (
    this.hash.substring(0, difficulty) !== Array(difficulty).fill("0").join("")
  ) {
    this.nonce++;
    this.hash = this.calcHash();
  }
  const end = new Date();

  //조건을 만족했을 때 nonce 값 출력
  //이 때 nonce는 해시를 한 횟수와 동일하다
  console.log("block is mined", this.nonce);
  //걸린 시간 출력
  console.log("ellipsed time is ", end.getTime() - start.getTime(), "ms");
};
Block.prototype.hasValidTransactions = function () {
  return this.transactions.every((tx) => {
    return tx.isValid();
  });
};

//Blockchain
const Blockchain = function () {
  this.chain = [this.createGenesisBlock()];
  this.difficulty = 2;
  //새로운 block이 mining될 때 까지 트랜잭션들은 이곳에 보관된다.
  //새로운 block이 채굴되면 거래 내역들이 블록에 포함된다.
  this.pendingTransactions = [];
  //채굴에 성공했을 때, 채굴자에게 수여되는 코인의 양
  //채굴자가 이 값을 임의로 바꾸는 것은 가능하지만
  //매우 많은 수의 사용자들이 P2P로 연결되어 있기 때문에 값을 조작할 경우 그 값은 무시될 것이다
  this.miningRewrad = 100;
};
Blockchain.prototype.minePendingTransactions = function (miningRewardAddress) {
  //예를 들어 비트코인에서는 현재 대기중인 모든 트랜잭션을 블록에 포함시키지는 않는다
  //비트코인에서 하나의 블록 사이즈는 1MB를 넘길 수 없으므로, 채굴자가 어떤 트랜잭션을 포함시킬지를 선택한다
  const block = new Block(
    Date.now(),
    this.pendingTransactions,
    this.getLatestBlock().hash
  );
  block.mining(this.difficulty);
  this.chain.push(block);

  this.pendingTransactions = [
    new Transaction(null, miningRewardAddress, this.miningRewrad),
  ];
};
Blockchain.prototype.addTransaction = function (transcation) {
  if (!transcation.toAddr || !transcation.fromAddr) {
    throw "보내는 사람 정보와 받는 사람 정보가 모두 존재해야 합니다";
  }
  if (!transcation.isValid()) {
    throw "무효한 트랜잭션입니다";
  }
  this.pendingTransactions.push(transcation);
};
//어떤 지갑 주소에 대해 잔액을 알고 싶을 떄 이 함수를 사용한다.
//각각의 주소에 대해 잔액을 저장하지 않기 때문에 모든 트랜잭션에 대해 순회하며 잔액을 계산해야 한다
Blockchain.prototype.getBalanceOfAddress = function (addr) {
  let balance = 0;
  this.chain.map((block, idx) => {
    if (idx === 0) {
      //genesis block은 생략한다
      return;
    }
    block.transactions.map((transcation) => {
      if (transcation.toAddr === addr) {
        balance += transcation.amount;
      }
      if (transcation.fromAddr === addr) {
        balance -= transcation.amount;
      }
    });
  });
  return balance;
};
// 더 이상 임의의 데이터를 블록에 추가시키는 동작을 하지 않는다
// Blockchain.prototype.addBlock = function (newBlock) {
//   //새로운 블록이 생성되면 가장 최근 블록의 해시값을 새로운 블록의 prevHash에 복사한다
//   newBlock.prevHash = this.getLatestBlock().hash;
//   newBlock.mining(this.difficulty);

//   //해시 계산이 완료되면 블록체인에 연결시킨다
//   this.chain.push(newBlock);
// };
Blockchain.prototype.createGenesisBlock = function () {
  //번호 0번, 이전 해시 "0", data를 "GenesisBlock"으로 임의로 지정
  return new Block("2021/09/13", "GenesisBlock", "0");
};
Blockchain.prototype.getLatestBlock = function () {
  return this.chain[this.chain.length - 1];
};
Blockchain.prototype.isValid = function () {
  //제네시스 블록은 이전 블록이 없어 검사를 건너뛰기 위해 1부터 시작한다.
  for (let i = 1; i < this.chain.length; i++) {
    const currentBlock = this.chain[i];
    const prevHash = this.chain[i - 1].hash;

    //블록에 포함된 모든 트랜잭션이 유효한지도 검사
    if (!currentBlock.hasValidTransactions()) {
      return false;
    }

    if (currentBlock.prevHash !== prevHash) {
      //현재 블록의 이전 해시값이 일치하지 않음
      return false;
    } else if (currentBlock.calcHash() !== currentBlock.hash) {
      //현재 블록에 저장된 해시값과 다시 계산한 해시값이 일치하지 않음
      return false;
    }
  }
  return true;
};

module.exports = {
  Blockchain,
  Transaction,
};
