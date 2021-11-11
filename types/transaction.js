const { SHA256 } = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const crypto = require("crypto");

//Transaction은 보내는 지갑주소, 받을 지갑주소, 보낸 코인의 양을 포함하는 객체이다
const Transaction = function (fromAddr, toAddr, amount, nft) {
  this.fromAddr = fromAddr;
  this.toAddr = toAddr;
  this.amount = amount;
  this.signiture = null;

  //data에는 fromAddr이 업로드할 데이터(파일, 문자열 등)이 포함될 수 있다
  //또한 data를 포함시키기 위해서는 toAddr이 반드시 receptionist의 지갑 주소여야 하며
  //정해진 수수료만큼을 포함시켜야 한다.
  this.nft = nft;
};
Transaction.restore = (json) => {
  const tx = new Transaction(json.fromAddr, json.toAddr, json.amount, json.nft);
  tx.signiture = json.signiture;
  return tx;
};
//data is buf or string
Transaction.createTxWithNFT = async function (fromAddr, toAddr, data) {
  const nft = crypto.createHash("sha256").update(data).digest("hex");
  return new Transaction(fromAddr, toAddr, 0, nft);
};
Transaction.prototype.calcFee = function () {
  if (!this.nft) {
    return 0;
  }
  return 0;
  const length = JSON.stringify(this.nft).length;

  return Math.ceil(length / 1024);
};
Transaction.prototype.calcHash = function () {
  return SHA256(
    this.fromAddr + this.toAddr + this.amount + this.nft
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
  // if (!this.fromAddr) return true;

  if (!this.signiture) {
    throw "서명되지 않은 트랜잭션입니다";
  }

  const publicKey = ec.keyFromPublic(this.fromAddr, "hex");
  return publicKey.verify(this.calcHash(), this.signiture);
};

module.exports = Transaction;
