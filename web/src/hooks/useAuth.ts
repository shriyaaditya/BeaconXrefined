import { useState, useEffect } from "react";

interface ExtendedUser {
  uid: string;
  email: string;
  name?: string;
  location?: string;
}

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("beaconx_user");
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
        }
      }
      setLoading(false);
    }
  }, []);

  const signUp = async (name: string, email: string, password: string, location: string) => {
    setError(null);
    if (!name || !email || !password || !location) {
      const msg = "All fields are required";
      setError(msg);
      throw new Error(msg);
    }
    
    const newUser: ExtendedUser = {
      uid: `user-${Date.now()}`,
      email,
      name,
      location
    };
    
    if (typeof window !== "undefined") {
      localStorage.setItem("beaconx_user", JSON.stringify(newUser));
    }
    setUser(newUser);
    return newUser;
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    if (!email || !password) {
      const msg = "Email and password must not be empty.";
      setError(msg);
      throw new Error(msg);
    }

    const newUser: ExtendedUser = {
      uid: `user-${Date.now()}`,
      email,
      name: email.split('@')[0],
      location: "Default Center"
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("beaconx_user", JSON.stringify(newUser));
    }
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    setError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("beaconx_user");
    }
    setUser(null);
  };

  return { user, signUp, signIn, logout, loading, error };
}

