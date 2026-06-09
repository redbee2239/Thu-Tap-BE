class test{
    constructor(){
        this.noiDung = null;
    }
    setNoiDung(noiDung){
        this.noiDung = noiDung;
    }
    getNoiDung(){
        return this.noiDung;
    }

}
const hopChu = new test();
hopChu.setNoiDung("Xin Chào");
const loiChao=hopChu.getNoiDung();

const hopSo = new test();
hopSo.setNoiDung(7749);
const conSo=hopSo.getNoiDung();

console.log("Lời Chào: ",loiChao);
console.log("Con số: ",conSo);