"use client";

export interface AccountOption {
  id: string;
  username: string;
  instagramId: string;
  name?: string | null;
}

interface AccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  label?: string;
  /** Низкий селект (36px) с мелкой подписью — для шапок страниц. */
  compact?: boolean;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  includeAll = true,
  label = "Instagram-аккаунт",
  compact = false,
}: AccountSelectProps) {
  return (
    <label className="block">
      <span
        className={
          compact
            ? "mb-1.5 block text-[12px] font-semibold text-muted"
            : "label"
        }
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`select min-w-52 ${compact ? "!h-9 text-[13px]" : ""}`}
      >
        {includeAll && <option value="all">Все аккаунты</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            @{account.username}
          </option>
        ))}
      </select>
    </label>
  );
}
