"""
전화번호 암호화/복호화 서비스
AES-256 암호화 알고리즘 (Fernet) 사용

사용법:
    # 암호화
    python api/utils/cipher_service.py encrypt "010-6664-3744"
    
    # 복호화
    python api/utils/cipher_service.py decrypt "gAAAAABk..."
"""

import os
import sys
import base64
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from dotenv import load_dotenv

# .env 파일 로드 (프로젝트 루트에서)
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    # 루트에 없으면 현재 디렉토리에서도 찾기
    load_dotenv()


class CipherService:
    """전화번호 암호화/복호화 서비스"""
    
    def __init__(self, secret_key: str = None):
        """
        초기화
        
        Args:
            secret_key: 암호화 키 (없으면 .env의 SECRET_KEY 사용)
        """
        if secret_key is None:
            secret_key = os.getenv('SECRET_KEY')
            if not secret_key:
                raise ValueError(
                    "SECRET_KEY가 설정되지 않았습니다. "
                    ".env 파일에 SECRET_KEY를 추가해주세요."
                )
        
        # SECRET_KEY를 Fernet 키로 변환
        self.fernet_key = self._derive_fernet_key(secret_key)
        self.cipher = Fernet(self.fernet_key)
    
    def _derive_fernet_key(self, secret_key: str) -> bytes:
        """
        SECRET_KEY를 Fernet 키로 변환
        
        Args:
            secret_key: 원본 SECRET_KEY 문자열
            
        Returns:
            Fernet 키 (32바이트)
        """
        # PBKDF2를 사용하여 안전하게 키 유도
        salt = b'sajangpick_salt_2024'  # 고정 salt (실제 운영에서는 환경변수로 관리 권장)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
        return key
    
    def encrypt(self, plain_text: str) -> str:
        """
        평문을 암호화
        
        Args:
            plain_text: 암호화할 문자열 (예: "010-6664-3744")
            
        Returns:
            암호화된 문자열 (예: "gAAAAABk...")
        """
        if not plain_text:
            return ""
        
        try:
            encrypted_bytes = self.cipher.encrypt(plain_text.encode())
            return encrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"암호화 실패: {str(e)}")
    
    def decrypt(self, encrypted_text: str) -> str:
        """
        암호문을 복호화
        
        Args:
            encrypted_text: 암호화된 문자열 (예: "gAAAAABk...")
            
        Returns:
            복호화된 문자열 (예: "010-6664-3744")
        """
        if not encrypted_text:
            return ""
        
        try:
            decrypted_bytes = self.cipher.decrypt(encrypted_text.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"복호화 실패: {str(e)} (키가 잘못되었거나 데이터가 손상되었을 수 있습니다)")


def main():
    """CLI 인터페이스"""
    if len(sys.argv) < 3:
        print("사용법:")
        print('  암호화: python api/utils/cipher_service.py encrypt "010-6664-3744"')
        print('  복호화: python api/utils/cipher_service.py decrypt "gAAAAABk..."')
        sys.exit(1)
    
    command = sys.argv[1]
    text = sys.argv[2]
    
    try:
        cipher_service = CipherService()
        
        if command == "encrypt":
            result = cipher_service.encrypt(text)
            print(result)
        elif command == "decrypt":
            result = cipher_service.decrypt(text)
            print(result)
        else:
            print(f"알 수 없는 명령어: {command}")
            print("사용 가능한 명령어: encrypt, decrypt")
            sys.exit(1)
    except Exception as e:
        print(f"오류: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

