import postgres from "postgres";

// 1. Declare a single client variable that will hold either the DB or the Mock
let client: any;

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

// 2. Try to initialize real Postgres if the URL is provided
if (DATABASE_URL) {
  try {
    client = postgres(DATABASE_URL, {
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  } catch (error) {
    console.error("Failed to initialize PostgreSQL client:", error);
  }
}

// 3. Fallback Mock Query Runner if DATABASE_URL is missing or connection failed
if (!client) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("❌ CRITICAL ERROR: DATABASE_URL environment variable is missing or failed in production. Mock Mode is disabled for production environments to prevent data loss.");
  }

  console.warn("⚠️ DATABASE_URL environment variable is missing or failed. Dashboard is running in Mock Mode.");

  // Simple in-memory storage for testing without a database
  const store: Record<string, any[]> = {
    admin_users: [
      {
        id: 1,
        email: "admin@islandspares.com",
        password_hash: "admin123", // admin123
        pin_hash: null, // Will store bcrypt hash of 6-digit pin
        webauthn_user_id: "admin-webauthn-id-1", // Used for passkey linking
        full_name: "IslandSpares Admin",
        role: "admin",
      }
    ],
    bank_accs: [
      {
        id: 1,
        name: "IslandSpares PVT LTD",
        number: "1234567890",
        bank: "Bank of Ceylon",
        branch: "Colombo Main"
      }
    ],
    admin_clients: [],
    invoices: [],
    invoice_items: [],
    admin_incomes: [],
    admin_expenses: [],
    admin_quotations: [],
    quotation_items: [],
    projects: [],
    admin_agreements: [],
    passkeys: [] // webauthn credentials
  };

  const mockQueryRunner = async (strings: TemplateStringsArray, ...values: any[]) => {
    // Construct the query text
    const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ""), "").trim();
    const queryUpper = query.toUpperCase();

    // Simple routing of queries to mocked responses
    if (queryUpper.includes("FROM ADMIN_USERS")) {
      const emailVal = values.find(v => typeof v === "string" && v.includes("@"));
      if (emailVal) {
        return store.admin_users.filter(u => u.email.toLowerCase() === emailVal.toLowerCase());
      }
      return store.admin_users;
    }

    if (queryUpper.includes("FROM BANK_ACCS")) {
      return store.bank_accs;
    }

    if (queryUpper.includes("FROM ADMIN_CLIENTS")) {
      if (queryUpper.includes("WHERE ID =")) {
        const idVal = values[0];
        return store.admin_clients.filter(c => c.id === idVal);
      }
      return store.admin_clients;
    }

    if (queryUpper.includes("FROM INVOICES")) {
      if (queryUpper.includes("WHERE INVOICE_ID =")) {
        const idVal = values[0];
        const inv = store.invoices.find(i => i.invoice_id === idVal);
        if (inv) {
          const items = store.invoice_items.filter(item => item.invoice_id === idVal);
          return [{ ...inv, items }];
        }
        return [];
      }
      return store.invoices;
    }

    if (queryUpper.includes("FROM INVOICE_ITEMS")) {
      return store.invoice_items;
    }

    if (queryUpper.includes("FROM ADMIN_INCOMES")) {
      return store.admin_incomes;
    }

    if (queryUpper.includes("FROM ADMIN_EXPENSES")) {
      return store.admin_expenses;
    }

    if (queryUpper.includes("FROM ADMIN_QUOTATIONS")) {
      return store.admin_quotations;
    }

    if (queryUpper.includes("FROM PROJECTS")) {
      return store.projects;
    }

    if (queryUpper.includes("FROM ADMIN_AGREEMENTS")) {
      if (queryUpper.includes("WHERE ID =")) {
        const idVal = values[0];
        return store.admin_agreements.filter(a => a.id === idVal);
      }
      return store.admin_agreements;
    }

    // Handles INSERTS
    if (queryUpper.startsWith("INSERT INTO")) {
      const match = query.match(/INSERT INTO (\w+)/i);
      const tableName = match ? match[1].toLowerCase() : null;
      if (tableName && store[tableName]) {
        // Special case for passkeys
        if (tableName === "passkeys") {
            const newRecord: any = {};
            // Simplified mocking: assuming standard structure mapping based on our usage
            // In a real app we'd map column names to values. We'll just inject the values
            // based on the query structure later, or for now just accept what the API gives it via fallback.
            // Since this is mock db, let's just make it simple.
        }

        const newRecord: any = { id: store[tableName].length + 1 };
        values.forEach((v, idx) => {
          newRecord[`field_${idx}`] = v;
        });
        store[tableName].push(newRecord);
        return [newRecord];
      }
    }

    // Handles UPDATES (rudimentary mock)
    if (queryUpper.startsWith("UPDATE ADMIN_USERS")) {
      if (queryUpper.includes("SET PIN_HASH")) {
         const pinHash = values[0];
         const userId = values[1];
         const user = store.admin_users.find(u => u.id === userId);
         if (user) user.pin_hash = pinHash;
         return user ? [user] : [];
      }
    }

    if (queryUpper.includes("FROM PASSKEYS")) {
      if (queryUpper.includes("WHERE CREDENTIAL_ID =")) {
        const credId = values[0];
        return store.passkeys.filter(p => p.credential_id === credId);
      }
      if (queryUpper.includes("WHERE USER_ID =")) {
        const userId = values[0];
        return store.passkeys.filter(p => p.user_id === userId);
      }
      return store.passkeys;
    }

    // Return default empty list for other selects/updates
    return [];
  };

  client = mockQueryRunner;
}

// 4. Export cleanly at the very end so BOTH 'sql' and 'db' work across your app!
export default client;
export { client as db, client as sql };