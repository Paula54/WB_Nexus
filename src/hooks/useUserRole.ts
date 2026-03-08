import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "freelancer" | "customer";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    async function fetchRoles() {
      const { data } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user!.id);

      if (data && Array.isArray(data)) {
        setRoles(data.map((r: any) => r.role as AppRole));
      }
      setLoading(false);
    }

    fetchRoles();
  }, [user]);

  return {
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isFreelancer: roles.includes("freelancer"),
    isCustomer: roles.includes("customer"),
    hasRole: (role: AppRole) => roles.includes(role),
  };
}
