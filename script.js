let inputFileContent = '';
let optabFileContent = '';
let i = 0, j = 0;
const opcode_list = [];
const opcode_hex = {};
const sym_list = [];
const sym_addresses = [];
let locctr = 0;
let startingAddress = '';
let endAddress = 0; 


document.getElementById('assemblyCode').addEventListener('input', (event) => {
    inputFileContent = event.target.value;
    checkFilesAndEnableButton();
});


document.getElementById('optabCode').addEventListener('input', (event) => {
    optabFileContent = event.target.value;
    processOptabContents(optabFileContent);
    checkFilesAndEnableButton();
});


function checkFilesAndEnableButton() {
    const passOneButton = document.getElementById('passOneBtn');
    if (inputFileContent && optabFileContent) {
        passOneButton.disabled = false;
    }
}


function processOptabContents(content) {
    const lines = content.split('\n');
    opcode_list.length = 0; 
    for (let key in opcode_hex) delete opcode_hex[key]; 

    lines.forEach(line => {
        const [opcode, hexcode] = line.trim().split(/\s+/);
        if (opcode && hexcode) {
            opcode_list.push(opcode);
            opcode_hex[opcode] = hexcode;
        }
    });
}


function passOne() {
    const lines = inputFileContent.split('\n');
    let output = '';
    let intermediate = '';
    let symtab = `Label\tlocctr\tflag\n\n`;

    sym_list.length = 0; 
    sym_addresses.length = 0; 
    j = 0;
    locctr = 0;

    lines.forEach(line => {
        const words = line.trim().split(/\s+/);
        if (words.length <= 3) {
            let [label, opcode, operand] = words.map(word => word || '');
            output += `${label}\t${opcode}\t${operand}\n`;

            if (label !== '' && opcode !== 'START') {
                if (!sym_list.includes(label)) {
                    sym_list.push(label);
                    sym_addresses.push(locctr);
                    symtab += `${label}\t${locctr.toString(16).toUpperCase()}\t 0 \n`;
                }
            }

            if (opcode === 'START') {
                locctr = parseInt(operand, 16);
                startingAddress = locctr.toString(16).padStart(6, '0').toUpperCase();
                intermediate += `\t${label}\t${opcode}\t${operand}\n`;
            } else {
                intermediate += `${locctr.toString(16).toUpperCase()}\t${label}\t${opcode}\t${operand}\n`;

                if (opcode_list.includes(opcode)) {
                    locctr += 3;
                } else if (opcode === 'WORD') {
                    locctr += 3;
                } else if (opcode === 'RESW') {
                    locctr += (3 * parseInt(operand, 10));
                } else if (opcode === 'RESB') {
                    locctr += parseInt(operand, 10);
                } else if (opcode === 'BYTE') {
                    let len = operand.length - 3;
                    len = operand[0] === 'C' ? len : len / 2;
                    locctr += len;
                }
            }
        }
    });


    document.getElementById('intermediateCode').value = intermediate;
    document.getElementById('symtabCode').value = symtab;
    document.getElementById('passTwoBtn').disabled = false;
}

function passTwo() {
    const intermediateArr = document.getElementById('intermediateCode').value.split('\n').map(line => line.split(/\s+/));
    const symtabArr = document.getElementById('symtabCode').value.split('\n').slice(2).map(line => line.split(/\s+/));
    const optabArr = Object.keys(opcode_hex).map(key => [key, opcode_hex[key]]);

    let i = 1, objectCode;
    let objectCodeArr = [];

    while (intermediateArr[i][2] !== 'END') {
        let found = false;
        optabArr.forEach((opLine) => {
            if (opLine[0] === intermediateArr[i][2]) {
                found = true;
                objectCode = opLine[1];
                symtabArr.forEach((symLine) => {
                    if (symLine[0] === intermediateArr[i][3]) {
                        objectCode += symLine[1].padStart(4, '0');
                        objectCodeArr.push(objectCode);
                    }
                });
            }
        });

        if (!found) {
            if (intermediateArr[i][2] === 'WORD') {
                const val = parseInt(intermediateArr[i][3]);
                objectCode = val.toString(16).padStart(6, '0');
                objectCodeArr.push(objectCode);
            } else if (intermediateArr[i][2] === 'BYTE') {
                const val = intermediateArr[i][3].substring(2, intermediateArr[i][3].length - 1);
                objectCode = "";
                for (let char of val) {
                    objectCode += char.charCodeAt(0).toString(16);
                }
                objectCodeArr.push(objectCode);
            } else if (intermediateArr[i][2] === 'RESW' || intermediateArr[i][2] === 'RESB') {
                objectCode = "\t";
                objectCodeArr.push(objectCode);
            }
        }
        i++;
    }
    objectCodeArr.push("\t");

    let output = intermediateArr[0][0] + "\t" + intermediateArr[0][1] + "\t" + intermediateArr[0][2] + "\t" + intermediateArr[0][3] + "\n";
    for (let j = 1; j < intermediateArr.length; j++) {
        output += intermediateArr[j][0] + "\t" + intermediateArr[j][1] + "\t" + intermediateArr[j][2] + "\t" + intermediateArr[j][3] + "\t" + (objectCodeArr[j - 1] || "") + "\n";
    }

 
    const lower = parseInt(intermediateArr[1][0], 16);
    const upper = parseInt(intermediateArr[intermediateArr.length - 2][0], 16);
    const length = upper - lower;

    let header = "H^" + intermediateArr[0][1].padEnd(6, "_") + "^" + intermediateArr[1][0]  "\n";
    let text = "", size = 0, start = intermediateArr[1][0];
    let recordOutput = "", x = 1;

  
    while (x < intermediateArr.length - 1) {
        if (objectCodeArr[x - 1] === "\t") {
            x++;
            continue;
        }
        if (size === 0) {
            start = intermediateArr[x][0];
        }

        if (size + objectCodeArr[x - 1].length / 2 <= 30) {
            text += "^" + objectCodeArr[x - 1];
            size += objectCodeArr[x - 1].length / 2;
        } else {
            recordOutput += "T^" + start.padStart(6, '0') + "^" + size.toString(16).padStart(2, '0').toUpperCase() + text.toUpperCase() + "\n";
            size = 0;
            text = "";
            continue;
        }
        x++;
    }
    if (size > 0) {
        recordOutput += "T^" + start.padStart(6, '0') + "^" + size.toString(16).padStart(2, '0').toUpperCase() + text.toUpperCase() + "\n";
    }

    const endRecord = "E^" + intermediateArr[1][0].padStart(6, '0').toUpperCase();

    document.getElementById('objectCode').value = output;
    document.getElementById('recordOutput').value = header + recordOutput + endRecord;
}


document.getElementById('passOneBtn').addEventListener('click', passOne);
document.getElementById('passTwoBtn').addEventListener('click', passTwo);
