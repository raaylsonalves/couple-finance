export interface Transaction {
  id: number;
  account_id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  is_outing: boolean;
  is_credit: boolean;
  account_provider?: string;
}

export interface Profile {
  id: string;
  display_name?: string;
  partner_id?: string;
  budget?: number;
  income?: number;
  push_token?: string;
}

export interface NewExpense {
  description: string;
  amount: string;
  category: string;
  is_outing: boolean;
  is_credit: boolean;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
}
