const { generateKey } = require("./keygen");

//transcation.data영역에 데이터를 포함시키기 위해서는 반드시 receptionist 로 일정 비용을 지불해야 한다
const receptionist = generateKey("receptionist")[1];

module.exports = {
  receptionist,
};
