/**
 * 전화번호 암호화/복호화 서비스
 * 
 * AES-256-GCM 알고리즘을 사용하여 전화번호를 안전하게 암호화/복호화합니다.
 * 
 * 사용 방법:
 *   const cipher = require('./lib/cipher-service');
 *   
 *   // 암호화
 *   const encrypted = cipher.encrypt('010-6664-3744');
 *   
 *   // 복호화
 *   const decrypted = cipher.decrypt(encrypted);
 */

const crypto = require('crypto');

// 환경변수에서 암호화 키 가져오기 (32바이트 = 256비트)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || null;
const ALGORITHM = 'aes-256-gcm'; // AES-256-GCM 알고리즘 사용

// 키 검증
if (!ENCRYPTION_KEY) {
    console.warn('⚠️  경고: ENCRYPTION_KEY가 설정되지 않았습니다. 암호화 기능이 작동하지 않습니다.');
    console.warn('⚠️  .env 파일에 ENCRYPTION_KEY를 추가하거나 Render/Vercel 환경변수에 설정해주세요.');
}

/**
 * 암호화 키를 32바이트로 변환
 * @param {string} key - 원본 키
 * @returns {Buffer} 32바이트 키
 */
function getKey(key) {
    if (!key) {
        throw new Error('ENCRYPTION_KEY가 설정되지 않았습니다. 환경변수를 확인해주세요.');
    }
    
    // 키가 32바이트가 되도록 해시 처리
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * 전화번호 암호화
 * 
 * @param {string} phoneNumber - 암호화할 전화번호 (예: '010-6664-3744')
 * @returns {string} 암호화된 문자열 (Base64 인코딩)
 * 
 * @example
 * const encrypted = encrypt('010-6664-3744');
 * // 결과: 'gAAAAABk...' (암호화된 문자열)
 */
function encrypt(phoneNumber) {
    // 전화번호가 없으면 null 반환
    if (!phoneNumber || phoneNumber.trim() === '') {
        return null;
    }

    // ENCRYPTION_KEY가 없으면 원본 반환 (암호화 비활성화)
    if (!ENCRYPTION_KEY) {
        console.warn('⚠️  ENCRYPTION_KEY가 없어 전화번호를 암호화하지 않고 저장합니다.');
        return phoneNumber;
    }

    try {
        const key = getKey(ENCRYPTION_KEY);
        
        // 랜덤 초기화 벡터(IV) 생성 (12바이트, GCM 권장 크기)
        const iv = crypto.randomBytes(12);
        
        // 암호화 객체 생성
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        // 전화번호 암호화
        let encrypted = cipher.update(phoneNumber, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // 인증 태그 가져오기 (GCM의 보안 기능)
        const authTag = cipher.getAuthTag();
        
        // IV + 암호화된 데이터 + 인증 태그를 하나로 합치기
        // 형식: iv(12바이트) + authTag(16바이트) + encrypted(가변)
        const combined = Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'base64')
        ]);
        
        // Base64로 인코딩하여 반환
        return combined.toString('base64');
        
    } catch (error) {
        console.error('❌ 전화번호 암호화 오류:', error);
        // 암호화 실패 시 원본 반환 (시스템 안정성 유지)
        return phoneNumber;
    }
}

/**
 * 전화번호 복호화
 * 
 * @param {string} encryptedPhoneNumber - 암호화된 전화번호 (Base64 인코딩)
 * @returns {string} 복호화된 전화번호 (예: '010-6664-3744')
 * 
 * @example
 * const decrypted = decrypt('gAAAAABk...');
 * // 결과: '010-6664-3744'
 */
function decrypt(encryptedPhoneNumber) {
    // 암호화된 값이 없으면 null 반환
    if (!encryptedPhoneNumber || encryptedPhoneNumber.trim() === '') {
        return null;
    }

    // ENCRYPTION_KEY가 없으면 원본 반환 (암호화가 안 된 데이터)
    if (!ENCRYPTION_KEY) {
        // Base64 형식이 아니면 원본 데이터로 간주
        if (!encryptedPhoneNumber.match(/^[A-Za-z0-9+/=]+$/)) {
            return encryptedPhoneNumber;
        }
        // Base64 형식이면 복호화 시도 (키가 없어서 실패할 수 있음)
        console.warn('⚠️  ENCRYPTION_KEY가 없어 복호화를 시도합니다.');
    }

    try {
        const key = getKey(ENCRYPTION_KEY);
        
        // Base64 디코딩
        const combined = Buffer.from(encryptedPhoneNumber, 'base64');
        
        // IV, 인증 태그, 암호화된 데이터 분리
        const iv = combined.slice(0, 12);           // 처음 12바이트 = IV
        const authTag = combined.slice(12, 28);      // 다음 16바이트 = 인증 태그
        const encrypted = combined.slice(28);        // 나머지 = 암호화된 데이터
        
        // 복호화 객체 생성
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag); // 인증 태그 설정 (무결성 검증)
        
        // 복호화
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
        
    } catch (error) {
        // 복호화 실패 시 원본 반환 (기존 데이터 호환성 유지)
        // 이는 ENCRYPTION_KEY가 설정되기 전에 저장된 데이터를 위한 처리
        console.warn('⚠️  전화번호 복호화 실패 (기존 데이터일 수 있음):', error.message);
        return encryptedPhoneNumber;
    }
}

/**
 * 여러 전화번호를 한 번에 암호화
 * 
 * @param {Object} data - 전화번호가 포함된 객체
 * @param {string[]} phoneFields - 암호화할 필드명 배열
 * @returns {Object} 암호화된 객체
 * 
 * @example
 * const encrypted = encryptFields(
 *   { name: '홍길동', phone: '010-6664-3744', store_phone: '02-1234-5678' },
 *   ['phone', 'store_phone']
 * );
 */
function encryptFields(data, phoneFields = ['phone_number', 'store_phone_number', 'phone']) {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const result = { ...data };
    
    for (const field of phoneFields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = encrypt(result[field]);
        }
    }
    
    return result;
}

/**
 * 여러 전화번호를 한 번에 복호화
 * 
 * @param {Object} data - 암호화된 전화번호가 포함된 객체
 * @param {string[]} phoneFields - 복호화할 필드명 배열
 * @returns {Object} 복호화된 객체
 * 
 * @example
 * const decrypted = decryptFields(
 *   { name: '홍길동', phone: 'gAAAAABk...', store_phone: 'gAAAAABk...' },
 *   ['phone', 'store_phone']
 * );
 */
function decryptFields(data, phoneFields = ['phone_number', 'store_phone_number', 'phone']) {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const result = { ...data };
    
    for (const field of phoneFields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = decrypt(result[field]);
        }
    }
    
    return result;
}

module.exports = {
    encrypt,
    decrypt,
    encryptFields,
    decryptFields
};

