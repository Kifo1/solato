export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface CommandResponse {
  success: boolean;
  message: string;
}

export interface UserInfo {
  username: string;
  email: string;
}
