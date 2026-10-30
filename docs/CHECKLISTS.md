# What each person needs to do

Short lists to forward. Everything here is entered on the website or in `config.json`, never sent by email to the tool's developers.

## For the Microsoft 365 admin (about 15 minutes)

> We're setting up Attendance Desk, an internal tool that needs to read the emails sent to the **hr@amipi.com** group and send reminders and reports. Because hr@ is a group with no inbox of its own, please:
>
> 1. **Create a shared mailbox** `attendance@amipi.com` (Microsoft 365 admin center → Teams & groups → Shared mailboxes). No licence is needed.
> 2. **Add attendance@amipi.com as a member of the hr@amipi.com group**, so it receives a copy of everything sent to hr@.
> 3. In **portal.azure.com → Microsoft Entra ID → App registrations → New registration**, create "Attendance Desk" (single tenant).
> 4. Under **API permissions**, add **Microsoft Graph → Application permissions → Mail.Read** and **Mail.Send**, then **Grant admin consent**.
> 5. Limit the app to the **attendance@amipi.com** mailbox only (application access policy, or RBAC for Applications in Exchange Online).
> 6. Under **Certificates & secrets**, create a client secret.
> 7. Send these three values securely (not by plain email): **Directory (tenant) ID**, **Application (client) ID**, **Client secret value**.
>
> The tool only reads the attendance@ mailbox and sends from it. It never reads personal mailboxes, and never deletes or moves anything.

## For Jainam

1. **Confirm the shift times.** In Attendance Desk, go to **Rules & calendars → Shift timings**. Full Time (G, 9:30–18:30) and New York are confirmed. **Lokesh: the Day Time (D) timing.** Also check the remote codes (S1, E1, E4, G2, P1) and Mumbai's closing time, then tick **Confirmed**. The punch system seems to mark Indore staff late only after 10:00, while the stated rule is 9:30 with 15 minutes' grace. Please confirm which is right.
2. **Upload the team list and the Mumbai sheet.** On **Attendance files**, upload the team list (.ods or .xlsx) and each month's Mumbai sheet. The tool recognises each file by itself.
3. **Upload October so far.** Export the "Month Date Wise Performance" report for October from the punch system, and upload it on **Attendance files**. Upload again whenever you like, and once more with the full month after 31 Oct.
4. **Compare October.** Download the workbook from **Monthly report**. Mark any person or day where the tool and your own sheet disagree, and send the list. Every difference gets fixed.
5. **Two quick questions:** what do the punch remarks "M" and "EI" mean? Does anyone get leave balances tracked today (the 1.25 days a month)?

## For HR

1. **Email addresses.** On **People**, click each person, then **Edit details**, and add their work email. Reminders cannot reach them without it.
2. **Joining and leaving dates.** Add them for anyone who joined or left this year, so those days are not counted as absences. For example, the person absent all of September: if they left, set the leaving date.
3. **Nicknames.** Add the names people sign emails with (for example "Jolly", "Anna"), so their emails are matched.
4. **Holidays.** On **Rules & calendars → Holiday calendars**, check the Mumbai Diwali week (marked "Check date") and add the Paryushan last day.

## For you or the founder

1. **Report recipients.** On **Rules & calendars → Month close and reports**, add the email addresses that should receive the monthly Excel package.
2. **Accounts.** On **Rules & calendars → Who can sign in**, add accounts for HR and anyone else who needs to see the tool. Use **Viewer** unless they need to change things. Passwords need at least 8 characters, including a number.
3. **The NVIDIA key.** Confirm NVIDIA's free-key terms are fine for HR emails (they include sick-leave details).
4. **Switching email on.** When the trial looks right:
   - First, set `"sendEmail": true` and turn **Remind employees** off on the Rules page. Only HR and the report recipients get email.
   - When you are happy, turn **Remind employees** on.
   - Use **Preview** on the Reminders page to see exactly what each email says before switching on.
