const { SHA256 } = require("crypto-js");

const Transaction = require("./transaction");
const Blockchain = require("./blockchain");

//Block
//더 이상 index값은 필요하지 77766
//왜냐하면 어차피 블록들은 prevHash<->hash로 각각의 블 위치가 결정되기 때문이다
const Block = function (timestamp, transactions, prevHash = "") {
  this.timestamp = timestamp;
  this.transactions = transactions;
  this.prevHash = prevHash;
  this.hash = this.calcHash();
  this.nonce = 0;
};
Block.restore = (json) => {
  const block = new Block();
  block.timestamp = json.timestamp;
  block.transactions = Array.isArray(json.transactions)
    ? json.transactions.map((tx) => Transaction.restore(tx))
    : "genesisBlock";
  block.prevHash = json.prevHash;
  block.hash = json.hash;
  block.nonce = json.nonce;

  return block;
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
  while (!this.isValidNonce(difficulty)) {
    this.nonce++;
    this.hash = this.calcHash();
  }
  const end = new Date();

  //조건을 만족했을 때 nonce 값 출력
  //이 때 nonce는 해시를 한 횟수와 동일하다
  console.log("block is mined", this.nonce);
  //걸린 시간 출력
  console.log("ellipsed time is ", end.getTime() - start.getTime(), "ms");

  return this;
};
Block.prototype.miningAsync = function (difficulty, onMined) {
  const lazyExec = function (callback) {
    // console.log("lazyExec", this);
    setTimeout(callback.bind(this));
  }.bind(this);

  const stepping = function () {
    // console.log("stepping", this);
    if (!this.isValidNonce(difficulty)) {
      this.nonce++;
      this.hash = this.calcHash();

      lazyExec(stepping);
    } else {
      //mined!!
      console.log("block is mined", this.nonce);
      onMined(this);
    }
  };

  lazyExec(stepping);
};
Block.prototype.isValid = function (prevBlock, difficulty) {
  if (this.hash !== this.calcHash()) {
    console.log("hash 불일치");
    return false;
  }
  if (this.prevHash !== prevBlock.hash) {
    console.log("prevHash 불일치");
    return false;
  }
  if (!this.isValidNonce(difficulty)) {
    console.log("nonce 불일치");
    return false;
  }
  if (!this.hasValidTransactions()) {
    return false;
  }
  return true;
};
Block.prototype.isValidNonce = function (difficulty) {
  //difficulty개의 0으로 시작하는 hash가 발생될 때 까지 해시를 반복한다
  return (
    this.hash.substring(0, difficulty) === Array(difficulty).fill("0").join("")
  );
};
Block.prototype.hasValidTransactions = function () {
  if (this.transactions.length === 0) return true;
  return this.transactions.every((tx, idx) => {
    if (idx === 0 && !tx.fromAddr && tx.toAddr) {
      //채굴 보상은 반드시 0번에 위치한다
      return true;
    }
    return tx.isValid();
  });
};

module.exports = Block;
