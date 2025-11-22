# Deferred Features

## Data Import/Export Logic

The following functionality has been removed from the active codebase for future implementation as per product decision.

### Database Service (services/db.ts)

```typescript
  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // VALIDATION: Basic schema check to prevent corrupting DB
      if (data.checkIns && !Array.isArray(data.checkIns)) throw new Error("Invalid checkIns format");
      if (data.customTags && !Array.isArray(data.customTags)) throw new Error("Invalid tags format");
      
      // Validate check-in structure sample
      if (data.checkIns && data.checkIns.length > 0) {
          const sample = data.checkIns[0];
          if (!sample.id || !sample.timestamp || !sample.emotions) {
              throw new Error("Invalid check-in data structure");
          }
      }

      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const stores: string[] = [];
        if (data.checkIns) stores.push(STORE_CHECKINS);
        if (data.settings) stores.push(STORE_SETTINGS);
        if (data.customTags) stores.push(STORE_TAGS);
        
        if (stores.length === 0) {
            if (Array.isArray(data)) {
                // Legacy support with validation
                if (data.length > 0 && (!data[0].id || !data[0].timestamp)) {
                     reject(new Error("Invalid legacy data format"));
                     return;
                }
                const tx = db.transaction([STORE_CHECKINS], 'readwrite');
                const store = tx.objectStore(STORE_CHECKINS);
                data.forEach((item: any) => store.put(item));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                return;
            }
            resolve();
            return;
        }

        const transaction = db.transaction(stores, 'readwrite');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        if (data.checkIns && Array.isArray(data.checkIns)) {
          const store = transaction.objectStore(STORE_CHECKINS);
          data.checkIns.forEach((item: any) => store.put(item));
        }

        if (data.settings) {
           const store = transaction.objectStore(STORE_SETTINGS);
           store.put({ key: 'app_settings', value: data.settings });
        }

        if (data.customTags && Array.isArray(data.customTags)) {
            const store = transaction.objectStore(STORE_TAGS);
            data.customTags.forEach((item: any) => store.put(item));
        }
      });
    } catch (e) {
      console.error("Import Error:", e);
      throw new Error("Invalid data format");
    }
  }
```

### Settings Screen UI (screens/SettingsScreen.tsx)

Removed Buttons and Handlers for CSV Export, JSON Backup, and Restore.

```tsx
const handleExportCSV = async () => { ... }
const handleFileChange = (e) => { ... }

// JSX Removed:
<button onClick={handleExportCSV} ... >Export as CSV</button>
<button onClick={onExportData} ... >Backup Data (JSON)</button>
<input type="file" accept=".json" ref={fileInputRef} ... />
<button onClick={() => fileInputRef.current?.click()} ... >Restore Backup</button>
```
