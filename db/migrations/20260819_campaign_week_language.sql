update notification_templates
set email_text = replace(email_text, '52-installment', '52-week'),
    email_html = replace(email_html, '52-installment', '52-week')
where email_text like '%52-installment%'
   or email_html like '%52-installment%';
