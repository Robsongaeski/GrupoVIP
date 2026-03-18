import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  ticket_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function useTicketNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("ticket_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.read).length || 0);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      await supabase
        .from("ticket_notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from("ticket_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  const markTicketAsRead = async (ticketId: string) => {
    if (!user) return;

    try {
      await supabase
        .from("ticket_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("ticket_id", ticketId)
        .eq("read", false);

      setNotifications((prev) =>
        prev.map((n) =>
          n.ticket_id === ticketId ? { ...n, read: true } : n
        )
      );
      
      // Recalcular contagem
      const unread = notifications.filter(
        (n) => !n.read && n.ticket_id !== ticketId
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Erro ao marcar ticket como lido:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Polling a cada 30 segundos
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    markTicketAsRead,
    refetch: fetchNotifications,
  };
}
