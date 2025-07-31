import { useAuthStore } from '@/store/useAuthStore';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { refreshAccessToken } from './auth';

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

instance.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // FormData인 경우 Content-Type 헤더 제거 (자동 설정되도록)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

instance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response) {
      const { status } = error.response;
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
      const refreshToken = useAuthStore.getState().refreshToken;
      const setAccessToken = useAuthStore.getState().setAccessToken;
      const setRefreshToken = useAuthStore.getState().setRefreshToken;
      const clearAuthStore = useAuthStore.getState().clearAuthStore;

      if (status === 401 && refreshToken && !originalRequest._retry) {
        try {
          const res = await refreshAccessToken(refreshToken);
          setAccessToken(res.accessToken);
          setRefreshToken(res.refreshToken);

          originalRequest._retry = true;
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${res.accessToken}`,
          };

          return instance(originalRequest);
        } catch () {
          // 리프레시 토큰도 만료 시 로그아웃 등 추가 처리
          console.error('토큰 재발급 실패, 로그아웃 처리');
          clearAuthStore();
          useAuthStore.persist.clearStorage();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default instance;
