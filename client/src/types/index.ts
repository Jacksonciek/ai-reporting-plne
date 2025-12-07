//index.ts
// Message type definition
export interface Message {
    id: string;
    room_id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    image?: string;
    document?: string;
    excel?: string;
  }
  
  // Room type definition
  export interface Room {
    room_id: number;
    room_name?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
  }
  
  // API Response types
  export interface ApiResponse<T> {
    data: T;
    message?: string;
    status?: string;
  }
  
  export interface MessagesResponse {
    messages: Message[];
    total?: number;
    page?: number;
    limit?: number;
  }
  
  export interface RoomsResponse {
    data: Room[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  }
  
  export interface CreateRoomResponse {
    room_id: number;
    room_name?: string;
    created_at?: string;
  }
  
export interface BotResponse {
    text: string;
    image?: string;
    document?: string;
    excel?: string;
  }
  
export interface MessagePairResponse {
    user: {
      text: string;
    };
    bot: BotResponse;
    response?: string; // Fallback for different API response formats
  }

  export interface WeeklyActivity {
    day: string; // ISO date
    total: number;
  }
  
  // API Service parameters
  export interface GetRoomsParams {
    page?: number;
    limit?: number;
    user_id?: number;
  }
  
  export interface UpdateRoomParams {
    name?: string;
    room_name?: string;
  }
  
  // Error types
export interface ApiError {
    message: string;
    status?: number;
    code?: string;
  }

  export interface Transaction {
    id_transaksi: string | number;
    tanggal?: string;
    nama_produk?: string;
    kategori?: string;
    jumlah_terjual?: string | number;
    harga_satuan?: string | number;
    total_penjualan?: string | number;
    kota?: string;
    salesperson?: string;
    status_pembayaran?: string;
    metode_pembayaran?: string;
    konsumen?: string;
    source_filename?: string;
    ocr_preview?: string;
    ocr_confidence?: number;
    created_at?: string;
    updated_at?: string;
  }

  export interface AdminLoginResponse {
    token: string;
    user: { id: number; username: string; role?: string; chat_user_id?: number };
    message?: string;
  }

  export interface OcrHistoryEntry {
    id: number;
    transaksi_id?: number | null;
    filename: string;
    filesize_bytes: number;
    page_count: number;
    status: 'uploading' | 'processing' | 'success' | 'failed';
    message?: string | null;
    fields_json?: Record<string, unknown> | null;
    ocr_preview?: string | null;
    created_at?: string;
    updated_at?: string;
    completed_at?: string | null;
  }
