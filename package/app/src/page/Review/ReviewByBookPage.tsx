import { useParams } from 'wouter'

import { ReviewList } from '@/component/Review/ReviewList';

export function ReviewByBookPage() {
    const params = useParams();
    const bookId = params[0];
    
    return (
        <div>
            <ReviewList.Show reviews={[]} isReplyModalOpen={false} currentReplyId={null} onReply={() => {}} onCloseReplyModal={() => {}} />
        </div>
    )
}