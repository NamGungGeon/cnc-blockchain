const SHA256 = require("crypto-js/sha256");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");

const wallets = require("./wallets");

//Transaction은 보내는 지갑주소, 받을 지갑주소, 보낸 코인의 양을 포함하는 객체이다
const Transaction = function (fromAddr, toAddr, amount, data) {
  this.fromAddr = fromAddr;
  this.toAddr = toAddr;
  this.amount = amount;

  //data에는 fromAddr이 업로드할 데이터(파일, 문자열 등)이 포함될 수 있다
  //또한 data를 포함시키기 위해서는 toAddr이 반드시 receptionist의 지갑 주소여야 하며
  //정해진 수수료만큼을 포함시켜야 한다.
  this.data = data;
};
//data is buf or string
Transaction.withDataUpload = async function (fromAddr, toAddr, data) {
  const fileHash = crypto.createHash("sha256").update(data).digest("hex");
  return new Transaction(fromAddr, wallets.receptionist, 0, fileHash);
};
Transaction.prototype.calcFee = function () {
  if (!this.data) {
    return 0;
  }
  const length = JSON.stringify(this.data).length;

  return Math.ceil(length / 1024);
};
Transaction.prototype.calcHash = function () {
  return SHA256(
    this.fromAddr + this.toAddr + this.amount + this.data
  ).toString();
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
//더 이상 index값은 필요하지 77766
//왜냐하면 어차피 블록들은 prevHash<->hash로 각각의 블 위치가 결정되기 때문이다
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
Blockchain.prototype.findDataOwner = function (data) {
  let owner = null;
  //pendingTransaction부터 처리
  if (this.pendingTransactions.length) {
    for (let i = this.pendingTransactions.length - 1; i >= 0; i--) {
      const ptx = this.pendingTransactions[i];
      if (ptx.data === data) {
        if (ptx.toAddr === wallets.receptionist) {
          owner = ptx.fromAddr;
        } else {
          owner = ptx.toAddr;
        }
      }
      if (owner) break;
    }
    if (owner) return owner;
  }

  //pendingTransaction에서 못찾았으면 block에서 탐색
  for (let i = this.chain.length - 1; i >= 0; i--) {
    const block = this.chain[i];
    for (let j = block.transactions.length - 1; j >= 0; j--) {
      const tx = block.transactions[j];
      if (tx.data === data) {
        if (tx.toAddr === wallets.receptionist) {
          owner = tx.fromAddr;
        } else {
          owner = tx.toAddr;
        }
      }
    }
    if (owner) break;
  }
  return owner;
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
Blockchain.prototype.addTransaction = function (transaction) {
  if (!transaction.toAddr || !transaction.fromAddr) {
    throw "보내는 사람 정보와 받는 사람 정보가 모두 존재해야 합니다";
  }
  if (!transaction.isValid()) {
    throw "무효한 트랜잭션입니다";
  }
  if (transaction.data && transaction.toAddr !== wallets.receptionist) {
    throw "데이터를 포함시키기 위해서는 반드시 지정된 지갑에 수수료를 지불해야 합니다";
  }

  if (transaction.data) {
    const owner = this.findDataOwner(transaction.data);
    console.log("owner", owner);
    if (owner && transaction.fromAddr !== owner) {
      throw "해당 토큰의 소유자가 아닙니다";
    }
  }

  if (
    transaction.data &&
    this.getTransactionCountOfAddress(transaction.fromAddr) === 0
  ) {
    //처음 사용자일 경우 해당 트랜잭션에 대한 수수료 면제
    //-> 해당 트랜잭션의 수수료만큼 코인 지급
    this.pendingTransactions = [
      ...this.pendingTransactions,
      new Transaction(null, transaction.fromAddr, transaction.calcFee()),
    ];
  }
  if (transaction.data) {
    //보내는 데이터가 있는 경우 해당 데이터에서 계산된 수수료를 amount로 지정
    transaction.amount = transaction.calcFee();
  }
  //pendingTranscation에 포함된 거래내역에 대해 잔액 변동률 계산
  let balanceDeltaFromPendingTransactions = 0;
  this.pendingTransactions.map((tx) => {
    if (tx.fromAddr === transaction.fromAddr) {
      balanceDeltaFromPendingTransactions -= tx.amount;
    } else if (tx.toAddr === transaction.fromAddr) {
      balanceDeltaFromPendingTransactions += tx.amount;
    }
  });
  if (
    this.getBalanceOfAddress(transaction.fromAddr) -
      transaction.amount +
      balanceDeltaFromPendingTransactions <
    0
  ) {
    throw "잔액보다 더 많이 보낼 수 없습니다";
  }
  //can submit transcation to blockchain
  this.pendingTransactions.push(transaction);
};

Blockchain.prototype.getTransactionCountOfAddress = function (addr) {
  //블록체인에 존재하는 트랜잭션에서 해당 주소로 된 트랜잭션이 있는지 탐색
  let txCnt = this.chain.reduce((acc, block, idx) => {
    if (idx === 0) return acc;
    let next = acc;
    block.transactions.forEach((tx) => {
      if (tx.toAddr === addr || tx.fromAddr === addr) next++;
    });

    return next;
  }, 0);
  //pendingTransactions에 해당 주소로 된 트랜잭션이 있는지 탐색
  this.pendingTransactions.forEach((tx) => {
    if (tx.toAddr === addr || tx.fromAddr === addr) txCnt++;
  });

  return txCnt;
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
