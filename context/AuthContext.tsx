"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

interface User {
  id?: number;
  name: string;
  phone: string;
  email: string;
  role: string; 
  role_id?: number;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          console.error("Error parsing user from localStorage", err);
        }
      }
      setIsMounted(true);
    }
  }, []);

  const login = useCallback((user: User) => {
    setUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }
  }, []);

  // ✅ ห่อ value ด้วย useMemo — ทำให้ reference ของ object ที่ส่งให้ Provider
  // เปลี่ยนก็ต่อเมื่อ user เปลี่ยนแปลงจริงเท่านั้น (login/logout เสถียรอยู่แล้วจาก useCallback ด้านบน)
  // ป้องกันไม่ให้ component ที่เรียก useAuth() ทั่วแอป re-render/refetch โดยไม่จำเป็น
  // เมื่อ AuthProvider re-render จากสาเหตุอื่นที่ไม่เกี่ยวกับ user เลย
  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  if (!isMounted) return null;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
