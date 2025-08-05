# Card Deactivation Blocking System

## Overview

This document explains what happens when a user card is deactivated in the Klik backend system. The system implements a comprehensive blocking mechanism that prevents access to profiles with deactivated cards while providing clear feedback to users.

## What Happens When a Card is Deactivated

### For Anonymous Users
When anonymous users try to access a profile with a deactivated card:
- They see a blocking message: "Card Deactivated"
- The message explains that the card is no longer available
- They're prompted to contact the development team if they believe it's an error
- They can click "Go Home" to return to the homepage

### For the Card Owner (Authenticated User)
When card owners view their own profile with a deactivated card:
- They see a personalized message: "Your Card Has Been Deactivated"
- It explains that their card has been deactivated by an administrator
- They're prompted to contact the development team for assistance
- They have options to "Go Home" or "Contact Support"

### For Other Authenticated Users
When authenticated users try to view someone else's profile with a deactivated card:
- They see the same blocking message as anonymous users
- The message explains that the card is no longer available
- They're prompted to contact the development team if they believe it's an error

## Technical Implementation

### Backend Endpoints

The backend provides two new endpoints to support card deactivation blocking:

#### 1. GET `/api/cards/username/{username}` (Authenticated)
- **Purpose**: Get card information by username for authenticated users
- **Authentication**: Required (JWT token)
- **Response**: Full card details including status, user information
- **Use Case**: When authenticated users view profiles to check card status

#### 2. GET `/api/cards/public/{username}/status` (Public)
- **Purpose**: Get public card status by username (no authentication required)
- **Authentication**: None required
- **Response**: Limited card status information (status, is_verified, username only)
- **Use Case**: When anonymous users or the frontend needs to check card status without authentication

### Database Schema

Cards have a `status` field that can be:
- `'active'` - Card is active and profile is accessible
- `'inactive'` - Card is deactivated and profile should be blocked

### Frontend Integration

The frontend components have been updated to:
1. Check card status when loading profiles
2. Show appropriate blocking messages based on user type and card status
3. Handle loading states for card status checks
4. Provide clear user feedback and contact information

## User Experience Flow

1. **User visits a profile URL**
2. **Frontend checks card status** using the appropriate endpoint
3. **If card is active**: Profile loads normally
4. **If card is inactive**: 
   - Show appropriate blocking message
   - Provide contact information
   - Offer navigation options (Go Home, Contact Support)

## Security Considerations

- Public endpoint only returns minimal status information
- No sensitive user data is exposed through the public endpoint
- Authenticated endpoint provides full card details for authorized users
- Card status is checked on every profile access attempt

## Error Handling

- 404 errors for non-existent users/cards
- 401 errors for unauthorized access attempts
- 500 errors for server issues
- Graceful fallbacks when card status cannot be determined

## Contact Information

Users are directed to contact the development team when they encounter deactivated cards. This provides a clear escalation path for users who believe their card was deactivated in error.

## Future Enhancements

Potential improvements could include:
- Email notifications when cards are deactivated
- Admin dashboard for managing card statuses
- Audit logs for card status changes
- Automatic reactivation workflows
- User appeal process for deactivated cards 