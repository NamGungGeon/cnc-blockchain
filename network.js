const io = require("socket.io-client");
const Peerjs = require("peerjs-nodejs");
const { Blockchain, Transaction } = require("./blockchain");
const {
  PeerCMD,
  CMD_REQUEST_FULLBLOCK,
  CMD_REQUEST_PTX,
  CMD_MAKE_BLOCK,
  CMD_MAKE_PTX,
} = require("./network-cmd");

let blockchain = new Blockchain();
const peerCMD = new PeerCMD(blockchain);
let peerCnt = 0;
const start = (socketAddr = "http://localhost:3000", peer = Peerjs()) => {
  peer.on("open", (myId) => {
    console.log("peer is opened", myId);
    //id는 peerjs 에서 사용할 고유 id

    const socket = io(socketAddr);
    socket.on("connect", () => {
      console.log("socket is connected");
    });
    socket.on("roomId", (roomId) => {
      console.log("roomId", roomId);

      // initSocket(socket, roomId);
      socket.emit("join-room", roomId, myId);
    });
    socket.on("user-list", (_users) => {
      console.log("on user-list");
      const users = JSON.parse(_users);
      console.log("current users", users);
      peerCnt = users.length;

      if (peerCnt === 0) {
        // NOTE: There is no user!
        // MY CHAIN IS RIGHT. NO NEED VALIDATION
        return;
      }

      users.forEach((userId) => {
        if (userId === myId) return;

        const conn = peer.connect(userId);
        conn.serialization = "json";
        conn.on("open", () => {
          peerCMD.sendCMD(CMD_REQUEST_FULLBLOCK, null, conn);
          console.log("peer connected!", userId);
        });
        conn.on("data", (msg) => {
          console.log("peer: onData", msg);
          if (typeof msg === "object" && msg.cmd) {
            const { cmd, data } = msg;
            try {
              peerCMD.receiveCMD(cmd, data, conn);
              if (cmd === CMD_REQUEST_FULLBLOCK && data) {
                const newBlock =
                  blockchain.minePendingTransactions("test addr");
                peerCMD.sendCMD(CMD_MAKE_BLOCK, newBlock, conn);
              }
            } catch (e) {
              console.error("onPeerCMDException", e);
            }
          } else {
            console.log("unknwon msg", msg, typeof msg);
          }
        });
        conn.on("close", () => {
          peerCnt--;
          console.log("peer is disconnected", userId);
        });
      });
    });
    socket.on("user-connected", (newUserId) => {
      console.log("on user-connected");

      const conn = peer.connect(newUserId);
      conn.serialization = "json";
      conn.on("open", () => {
        console.log("peer connected!", newUserId);
        peerCnt++;
      });
      conn.on("data", (msg) => {
        console.log("peer: onData", msg);
        if (typeof msg === "object" && msg.cmd) {
          const { cmd, data } = msg;
          try {
            peerCMD.receiveCMD(cmd, data, conn);
          } catch (e) {
            console.error("onPeerCMDException", e);
          }
        } else {
          console.log("unknwon msg", msg, typeof msg);
        }
      });
      conn.on("close", () => {
        console.log("peer is disconnected", newUserId);
        peerCnt--;
      });
    });
    socket.on("disconnect", () => {
      console.log("socket is connected");
    });
  });
  // peer data send/receive rules
  // {cmd: '', data: '...'}
  peer.on("connection", function (conn) {
    console.log("on connection");
    conn.on("open", () => {});
    conn.on("data", (msg) => {
      console.log("onData", msg, typeof msg);
      //msg is cmd with data?
      if (typeof msg === "object" && msg.cmd) {
        const { cmd, data } = msg;
        try {
          peerCMD.receiveCMD(cmd, data, conn);
        } catch (e) {
          console.error("onPeerCMDException", e);
        }
      }
    });
  });
};

start();

module.exports = {
  joinNetwork: start,
};
