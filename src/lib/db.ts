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
  console.warn("⚠️ DATABASE_URL environment variable is missing or failed. Dashboard is running in Mock Mode.");

  // Simple in-memory storage for testing without a database
  const store: Record<string, any[]> = {
    admin_users: [
      {
        id: 1,
        email: "admin@islandspares.com",
        password_hash: "admin123", // admin123
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
    admin_agreements: []
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
        const newRecord: any = { id: store[tableName].length + 1 };
        values.forEach((v, idx) => {
          newRecord[`field_${idx}`] = v;
        });
        store[tableName].push(newRecord);
        return [newRecord];
      }
    }

    // Return default empty list for other selects/updates
    return [];
  };

  client = mockQueryRunner;
}

// 4. Export cleanly at the very end so BOTH 'sql' and 'db' work across your app!
export default client;
export { client as db, client as sql };