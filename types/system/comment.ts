export interface CommentType {
  content: string;
  id: string;
  netVotes?: number;
  replyToId?: string;
  systemId: string;
  timestamp: number
  userId: string;
}
