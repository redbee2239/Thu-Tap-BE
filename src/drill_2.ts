export async function retry<T>(fn: () => Promise<T>, times: number): Promise<T> {
  if (!Number.isInteger(times) || times < 1) {
    throw new Error("times must be a positive integer");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= times; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("retry failed");
}

// Demo
async function demoRetry() {
  let count = 0;

  const result = await retry(async () => {
    count++;
    if (count < 3) {
      throw new Error(`Attempt ${count} failed`);
    }
    return `Success after ${count} tries`;
  }, 5);

  console.log("=== Drill 2: retry ===");
  console.log(result);
}

demoRetry().catch(console.error);
