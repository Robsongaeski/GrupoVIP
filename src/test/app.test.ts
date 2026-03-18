import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before any imports that use it
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }),
  },
}));

describe("Utility Functions", () => {
  it("cn utility should merge classNames correctly", async () => {
    const { cn } = await import("@/lib/utils");
    const result = cn("base-class", "additional-class", { conditional: true });
    expect(result).toContain("base-class");
    expect(result).toContain("additional-class");
    expect(result).toContain("conditional");
  });

  it("cn utility should handle undefined values", async () => {
    const { cn } = await import("@/lib/utils");
    const result = cn("base", undefined, null, "valid");
    expect(result).toContain("base");
    expect(result).toContain("valid");
  });
});

describe("Form Validation", () => {
  it("should validate email format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("valid@email.com")).toBe(true);
    expect(emailRegex.test("invalid-email")).toBe(false);
    expect(emailRegex.test("")).toBe(false);
  });

  it("should validate password minimum length", () => {
    const validatePassword = (pwd: string) => pwd.length >= 6;
    expect(validatePassword("123456")).toBe(true);
    expect(validatePassword("12345")).toBe(false);
    expect(validatePassword("")).toBe(false);
  });

  it("should validate phone format", () => {
    const phoneRegex = /^\+?[1-9]\d{10,14}$/;
    expect(phoneRegex.test("5511999999999")).toBe(true);
    expect(phoneRegex.test("+5511999999999")).toBe(true);
  });
});

describe("Data Formatting", () => {
  it("should format currency correctly", () => {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
    
    expect(formatCurrency(100)).toBe("R$\u00A0100,00");
    expect(formatCurrency(1234.56)).toBe("R$\u00A01.234,56");
    expect(formatCurrency(0)).toBe("R$\u00A00,00");
  });

  it("should format dates correctly", () => {
    const formatDate = (date: Date) =>
      new Intl.DateTimeFormat("pt-BR").format(date);
    
    const testDate = new Date("2026-01-28");
    expect(formatDate(testDate)).toMatch(/28\/01\/2026/);
  });
});

describe("Business Logic", () => {
  it("should calculate subscription expiry correctly", () => {
    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const today = new Date("2026-01-28");
    const expiry = addDays(today, 30);
    expect(expiry.getDate()).toBe(27);
    expect(expiry.getMonth()).toBe(1); // February
  });

  it("should validate subscription status correctly", () => {
    const isActive = (status: string) => ["active", "trial"].includes(status);
    
    expect(isActive("active")).toBe(true);
    expect(isActive("trial")).toBe(true);
    expect(isActive("suspended")).toBe(false);
    expect(isActive("cancelled")).toBe(false);
  });

  it("should check if subscription is expired", () => {
    const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
    
    expect(isExpired("2020-01-01")).toBe(true);
    expect(isExpired("2030-01-01")).toBe(false);
  });

  it("should calculate days remaining in subscription", () => {
    const getDaysRemaining = (expiresAt: string) => {
      const expiry = new Date(expiresAt);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    expect(getDaysRemaining(futureDate.toISOString())).toBe(10);
  });
});

describe("API Response Handling", () => {
  it("should handle successful API responses", () => {
    const handleResponse = (data: any, error: any) => {
      if (error) throw new Error(error.message);
      return data;
    };

    const successData = { id: 1, name: "Test" };
    expect(handleResponse(successData, null)).toEqual(successData);
  });

  it("should handle API errors gracefully", () => {
    const handleError = (error: any) => {
      if (error?.message?.includes("not found")) return "NOT_FOUND";
      if (error?.message?.includes("unauthorized")) return "UNAUTHORIZED";
      return "UNKNOWN_ERROR";
    };

    expect(handleError({ message: "Record not found" })).toBe("NOT_FOUND");
    expect(handleError({ message: "User unauthorized" })).toBe("UNAUTHORIZED");
    expect(handleError({ message: "Something else" })).toBe("UNKNOWN_ERROR");
  });

  it("should validate API pagination parameters", () => {
    const validatePagination = (page: number, limit: number) => {
      if (page < 1) return { error: "Page must be >= 1" };
      if (limit < 1 || limit > 100) return { error: "Limit must be 1-100" };
      return { page, limit, offset: (page - 1) * limit };
    };

    expect(validatePagination(1, 10)).toEqual({ page: 1, limit: 10, offset: 0 });
    expect(validatePagination(2, 20)).toEqual({ page: 2, limit: 20, offset: 20 });
    expect(validatePagination(0, 10)).toEqual({ error: "Page must be >= 1" });
    expect(validatePagination(1, 200)).toEqual({ error: "Limit must be 1-100" });
  });
});

describe("URL and Slug Validation", () => {
  it("should validate URL format", () => {
    const isValidUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("not-a-url")).toBe(false);
  });

  it("should validate slug format", () => {
    const isValidSlug = (slug: string) => /^[a-z0-9-]+$/.test(slug);

    expect(isValidSlug("valid-slug")).toBe(true);
    expect(isValidSlug("also-valid-123")).toBe(true);
    expect(isValidSlug("Invalid Slug")).toBe(false);
    expect(isValidSlug("invalid_slug")).toBe(false);
  });

  it("should generate valid slugs from text", () => {
    const generateSlug = (text: string) =>
      text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    expect(generateSlug("My Campaign")).toBe("my-campaign");
    expect(generateSlug("Test 123")).toBe("test-123");
    expect(generateSlug("Special @#$ Chars")).toBe("special--chars");
  });
});

describe("WhatsApp Number Validation", () => {
  it("should validate Brazilian phone numbers", () => {
    const isValidBrazilianPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      return /^55\d{10,11}$/.test(cleaned);
    };

    expect(isValidBrazilianPhone("5511999999999")).toBe(true);
    expect(isValidBrazilianPhone("+55 11 99999-9999")).toBe(true);
    expect(isValidBrazilianPhone("11999999999")).toBe(false);
    expect(isValidBrazilianPhone("123")).toBe(false);
  });

  it("should format phone for WhatsApp API", () => {
    const formatForWhatsApp = (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    };

    expect(formatForWhatsApp("11999999999")).toBe("5511999999999");
    expect(formatForWhatsApp("5511999999999")).toBe("5511999999999");
  });
});

describe("Campaign Logic", () => {
  it("should calculate campaign progress correctly", () => {
    const calculateProgress = (sent: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((sent / total) * 100);
    };

    expect(calculateProgress(50, 100)).toBe(50);
    expect(calculateProgress(0, 100)).toBe(0);
    expect(calculateProgress(100, 100)).toBe(100);
    expect(calculateProgress(0, 0)).toBe(0);
  });

  it("should validate campaign status transitions", () => {
    const canTransition = (from: string, to: string) => {
      const validTransitions: Record<string, string[]> = {
        draft: ["scheduled", "running", "deleted"],
        scheduled: ["running", "cancelled", "draft"],
        running: ["completed", "cancelled"],
        completed: ["deleted"],
        cancelled: ["draft", "deleted"],
      };
      return validTransitions[from]?.includes(to) ?? false;
    };

    expect(canTransition("draft", "running")).toBe(true);
    expect(canTransition("running", "completed")).toBe(true);
    expect(canTransition("completed", "running")).toBe(false);
  });
});

describe("Link Rotation Logic", () => {
  it("should select next available group by priority", () => {
    const selectNextGroup = (groups: { id: string; priority: number; isFull: boolean }[]) => {
      return groups
        .filter(g => !g.isFull)
        .sort((a, b) => a.priority - b.priority)[0] ?? null;
    };

    const groups = [
      { id: "1", priority: 2, isFull: false },
      { id: "2", priority: 1, isFull: false },
      { id: "3", priority: 0, isFull: true },
    ];

    expect(selectNextGroup(groups)?.id).toBe("2");
    expect(selectNextGroup([{ id: "1", priority: 0, isFull: true }])).toBe(null);
  });

  it("should check if link has capacity", () => {
    const hasCapacity = (currentClicks: number, limit: number) => currentClicks < limit;

    expect(hasCapacity(50, 100)).toBe(true);
    expect(hasCapacity(100, 100)).toBe(false);
    expect(hasCapacity(101, 100)).toBe(false);
  });
});

describe("Payment Calculations", () => {
  it("should calculate total revenue from payments", () => {
    const calculateRevenue = (payments: { amount: number; status: string }[]) =>
      payments
        .filter(p => p.status === "approved")
        .reduce((sum, p) => sum + p.amount, 0);

    const payments = [
      { amount: 100, status: "approved" },
      { amount: 50, status: "pending" },
      { amount: 75, status: "approved" },
    ];

    expect(calculateRevenue(payments)).toBe(175);
  });

  it("should identify overdue payments", () => {
    const isOverdue = (paidAt: string | null, createdAt: string, graceDays: number) => {
      if (paidAt) return false;
      const created = new Date(createdAt);
      const deadline = new Date(created.getTime() + graceDays * 24 * 60 * 60 * 1000);
      return new Date() > deadline;
    };

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    
    expect(isOverdue(null, oldDate.toISOString(), 3)).toBe(true);
    expect(isOverdue("2026-01-01", oldDate.toISOString(), 3)).toBe(false);
  });
});
