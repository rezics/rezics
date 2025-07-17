import { useParams } from 'wouter'

import { ReviewList } from '@/component/Review/ReviewList';
import { useTranslation } from 'react-i18next';

export function ReviewByBookPage() {
    const params = useParams();
    const bookId = params[0];
    const { t } = useTranslation();
    
    return (
        <div>
            <ReviewList.Show reviews={[]} isReplyModalOpen={false} currentReplyId={null} onReply={() => {}} onCloseReplyModal={() => {}} />
            {t("pages.book_list_edit_page")}
        </div>
    )
}