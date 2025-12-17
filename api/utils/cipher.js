/**
 * 전화번호 암호화/복호화 유틸리티 (Node.js)
 * Python CipherService를 호출합니다.
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Python CipherService를 호출하여 암호화/복호화 수행
 * 
 * @param {string} command - 'encrypt' 또는 'decrypt'
 * @param {string} text - 암호화/복호화할 문자열
 * @returns {Promise<string>} 암호화/복호화된 결과
 */
function callCipherService(command, text) {
  return new Promise((resolve, reject) => {
    // Python 스크립트 경로
    const scriptPath = path.join(__dirname, 'cipher_service.py');
    
    // Python 명령어 실행
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(python, [scriptPath, command, text]);
    
    let output = '';
    let errorOutput = '';
    
    // 표준 출력 수집
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // 에러 출력 수집
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // 프로세스 종료 처리
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python 스크립트 실행 실패 (코드: ${code}): ${errorOutput || output}`));
        return;
      }
      
      // 성공적으로 완료
      const result = output.trim();
      resolve(result);
    });
    
    // 프로세스 에러 처리
    child.on('error', (error) => {
      reject(new Error(`Python 스크립트 실행 오류: ${error.message}`));
    });
  });
}

/**
 * 전화번호 암호화
 * 
 * @param {string} phoneNumber - 암호화할 전화번호 (예: "010-6664-3744")
 * @returns {Promise<string>} 암호화된 문자열
 */
async function encryptPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return '';
  }
  
  try {
    const encrypted = await callCipherService('encrypt', phoneNumber);
    return encrypted;
  } catch (error) {
    console.error('전화번호 암호화 실패:', error.message);
    throw error;
  }
}

/**
 * 전화번호 복호화
 * 
 * @param {string} encryptedPhoneNumber - 암호화된 전화번호 (예: "gAAAAABk...")
 * @returns {Promise<string>} 복호화된 전화번호
 */
async function decryptPhoneNumber(encryptedPhoneNumber) {
  if (!encryptedPhoneNumber) {
    return '';
  }
  
  try {
    const decrypted = await callCipherService('decrypt', encryptedPhoneNumber);
    return decrypted;
  } catch (error) {
    console.error('전화번호 복호화 실패:', error.message);
    throw error;
  }
}

module.exports = {
  encryptPhoneNumber,
  decryptPhoneNumber,
  callCipherService
};

