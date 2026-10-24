// Serviço de Autenticação Biométrica do Dispositivo (Impressão Digital / TouchID / Windows Hello)
// Utiliza a API nativa WebAuthn (Web Authentication API) do W3C para validar a identidade física

export interface DeviceBiometricResult {
  success: boolean;
  biometricType?: 'fingerprint' | 'face' | 'device_pin';
  error?: string;
  authenticatorName?: string;
}

// 1. Verifica se o navegador e o aparelho possuem sensor biométrico físico disponível
export async function isDeviceBiometricAvailable(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  ) {
    return false;
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch (err) {
    return false;
  }
}

// 2. Aciona o leitor biométrico nativo do aparelho (Digital no Android/iOS ou TouchID/Windows Hello)
export async function authenticateWithDeviceBiometrics(
  userName: string,
  reason: string = 'Confirmação de Identidade para Assinatura SST'
): Promise<DeviceBiometricResult> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Ambiente não suportado.' };
  }

  // Fallback se WebAuthn não estiver disponível no navegador
  if (!window.PublicKeyCredential) {
    return {
      success: false,
      error: 'Seu navegador não suporta biometria digital nativa (WebAuthn).'
    };
  }

  try {
    const isAvailable = await isDeviceBiometricAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: 'O aparelho não possui leitor de impressão digital ou biometria cadastrada no sistema operacional.'
      };
    }

    // Desafio criptográfico aleatório de 32 bytes
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    // Solicita ao sistema operacional a validação biométrica do usuário (User Verification)
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'SegTrabalho SST',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Sensor nativo do aparelho (Digital/TouchID)
          userVerification: 'required' // Exige biometria do titular
        },
        timeout: 60000,
        attestation: 'none'
      }
    })) as PublicKeyCredential;

    if (credential && credential.id) {
      return {
        success: true,
        biometricType: 'fingerprint',
        authenticatorName: 'Sensor Biométrico do Aparelho (TouchID / Impressão Digital)'
      };
    }

    return {
      success: false,
      error: 'Não foi possível validar a biometria digital no aparelho.'
    };
  } catch (err: any) {
    console.warn('[DeviceBiometrics] Falha na leitura digital:', err);

    // Se o usuário cancelou o prompt biométrico
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Leitura biométrica cancelada ou impressão digital não reconhecida pelo aparelho.'
      };
    }

    // Se a restrição de domínio rp.id falhou (ex: localhost vs IP), tentamos chamada simplificada
    if (err.name === 'SecurityError' || err.message?.includes('domain')) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const fallbackCred = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'SegTrabalho SST' },
            user: { id: userId, name: userName, displayName: userName },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: { userVerification: 'required' },
            timeout: 60000
          }
        });

        if (fallbackCred) {
          return {
            success: true,
            biometricType: 'fingerprint',
            authenticatorName: 'Sensor Biométrico do Aparelho'
          };
        }
      } catch (fallbackErr: any) {
        return {
          success: false,
          error: fallbackErr.message || 'Erro ao processar biometria do dispositivo.'
        };
      }
    }

    return {
      success: false,
      error: err.message || 'Falha ao autenticar com a digital do aparelho.'
    };
  }
}
