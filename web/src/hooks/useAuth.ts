import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface ExtendedUser {
  uid: string;
  email: string;
  name?: string;
  role?: string;
  assigned_region?: string;
  assigned_district?: string;
  location?: string;
}

const validateEmail = (email: string): boolean => {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return domain === "gov.in" || domain === "nic.in" || domain.endsWith(".gov.in");
};

export function useAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string, email: string) => {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to fetch user profile:", profileError.message);
      const fallbackUser: ExtendedUser = {
        uid,
        email,
        name: email.split('@')[0],
        role: "viewer"
      };
      setUser(fallbackUser);
      return fallbackUser;
    }

    const mergedUser: ExtendedUser = {
      uid,
      email,
      name: profile.full_name,
      role: profile.role,
      assigned_region: profile.assigned_region,
      assigned_district: profile.assigned_district,
      location: profile.assigned_region || ""
    };
    setUser(mergedUser);
    return mergedUser;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || "").finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || "");
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (name: string, email: string, password: string, location: string) => {
    setError(null);
    if (!name || !email || !password) {
      const msg = "All fields are required";
      setError(msg);
      throw new Error(msg);
    }

    if (!validateEmail(email)) {
      const msg = "Access denied. Only authorized government email addresses are allowed.";
      setError(msg);
      throw new Error(msg);
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          assigned_region: location
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }

    return data.user;
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    if (!email || !password) {
      const msg = "Email and password must not be empty.";
      setError(msg);
      throw new Error(msg);
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }

    if (data.user) {
      return await fetchProfile(data.user.id, data.user.email || "");
    }
    return null;
  };

  const logout = async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setUser(null);
  };

  return { user, signUp, signIn, logout, loading, error };
}
