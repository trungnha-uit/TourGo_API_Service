const nodemailer = require('nodemailer');

// Initialize transporter
let transporter;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} else {
    console.warn('⚠️ SMTP credentials not configured. Emails will be logged to the console.');
}

async function sendMail({ to, subject, html, text }) {
    const from = process.env.SMTP_FROM || '"TourGo Support" <support@tourgo.com>';
    if (transporter) {
        try {
            const info = await transporter.sendMail({
                from,
                to,
                subject,
                text,
                html
            });
            console.log(`✉️ Email sent successfully to ${to}. Message ID: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error(`❌ Error sending email to ${to}:`, error);
            throw error;
        }
    } else {
        console.log('\n--- [MOCK EMAIL SENT] ---');
        console.log(`From: ${from}`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Text:\n${text}`);
        console.log('-------------------------\n');
        return { messageId: 'mock-id-' + Date.now() };
    }
}

exports.sendBusinessRegistrationEmail = async (toEmail, businessName) => {
    return sendMail({
        to: toEmail,
        subject: '[TourGo] Đăng ký đối tác thành công - Chờ phê duyệt',
        text: `Chào bạn,\n\nYêu cầu đăng ký đối tác của doanh nghiệp "${businessName}" đã được tiếp nhận thành công và đang chờ Admin phê duyệt.\n\nChúng tôi sẽ thông báo cho bạn ngay khi có kết quả.\n\nTrân trọng,\nTourGo Team`,
        html: `
            <h3>Chào bạn,</h3>
            <p>Yêu cầu đăng ký đối tác của doanh nghiệp <strong>"${businessName}"</strong> đã được tiếp nhận thành công và đang chờ Admin phê duyệt.</p>
            <p>Chúng tôi sẽ thông báo cho bạn ngay khi có kết quả.</p>
            <br>
            <p>Trân trọng,<br><strong>TourGo Team</strong></p>
        `
    });
};

exports.sendBusinessApprovalEmail = async (toEmail, businessName) => {
    return sendMail({
        to: toEmail,
        subject: '[TourGo] Tài khoản đối tác của bạn đã được PHÊ DUYỆT',
        text: `Chúc mừng bạn!\n\nYêu cầu đăng ký đối tác của doanh nghiệp "${businessName}" đã được Admin phê duyệt thành công.\n\nTài khoản của bạn đã được nâng cấp lên quyền Doanh nghiệp (Business). Bạn có thể đăng nhập lại vào ứng dụng để bắt đầu đăng tải Tour/Khách sạn mới.\n\nTrân trọng,\nTourGo Team`,
        html: `
            <h3 style="color: green;">Chúc mừng bạn!</h3>
            <p>Yêu cầu đăng ký đối tác của doanh nghiệp <strong>"${businessName}"</strong> đã được Admin phê duyệt thành công.</p>
            <p>Tài khoản của bạn đã được nâng cấp lên quyền <strong>Doanh nghiệp (Business)</strong>. Bạn có thể đăng nhập lại vào ứng dụng để bắt đầu đăng tải Tour/Khách sạn mới.</p>
            <br>
            <p>Trân trọng,<br><strong>TourGo Team</strong></p>
        `
    });
};

exports.sendBusinessRejectionEmail = async (toEmail, businessName, reason) => {
    return sendMail({
        to: toEmail,
        subject: '[TourGo] Kết quả yêu cầu đăng ký đối tác',
        text: `Chào bạn,\n\nYêu cầu đăng ký đối tác của doanh nghiệp "${businessName}" đã bị từ chối.\n\nLý do từ chối: ${reason || 'Không có lý do cụ thể.'}\n\nVui lòng kiểm tra lại thông tin và gửi lại đơn đăng ký nếu cần thiết.\n\nTrân trọng,\nTourGo Team`,
        html: `
            <h3 style="color: red;">Chào bạn,</h3>
            <p>Yêu cầu đăng ký đối tác của doanh nghiệp <strong>"${businessName}"</strong> đã bị từ chối.</p>
            <p><strong>Lý do từ chối:</strong> ${reason || 'Không có lý do cụ thể.'}</p>
            <p>Vui lòng kiểm tra lại thông tin và gửi lại đơn đăng ký nếu cần thiết.</p>
            <br>
            <p>Trân trọng,<br><strong>TourGo Team</strong></p>
        `
    });
};
