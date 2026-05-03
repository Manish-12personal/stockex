# Routes Documentation

This directory contains all API route definitions organized by functionality. Each route file follows clean architecture principles for maintainability and consistency.

## Route File Structure

### Standard Organization
```
[routeName].js
├── Header Documentation
├── Imports
├── Router Initialization
├── Middleware Composition
├── Route Groups (by functionality)
└── Export
```

### Route Groups
Routes are organized into logical groups:
- **Settings** - Configuration management
- **CRUD** - Create, Read, Update, Delete operations
- **Analytics** - Statistics and reporting
- **Management** - Administrative operations
- **Public** - Publicly accessible endpoints

## Clean Architecture Guidelines

### 1. Documentation Standards
- Clear file header explaining purpose
- Group sections with descriptive comments
- JSDoc comments for each route
- Example requests/responses
- Use case descriptions

### 2. Middleware Composition
- Define reusable middleware arrays
- Use spread operator for clean application
- Group similar authentication requirements
- Clear naming conventions

### 3. Route Organization
- Group related functionality
- Consistent naming patterns
- Logical parameter ordering
- RESTful conventions

### 4. Error Handling
- Controllers handle business logic errors
- Routes handle validation and auth errors
- Consistent error response format
- Proper HTTP status codes

## Available Route Files

### Core Routes
- `adminManagementRoutes.js` - Admin and user management
- `userRoutes.js` - User operations and authentication
- `tradingRoutes.js` - Trading operations
- `adminRoutes.js` - Admin-specific operations

### Specialized Routes
- `referralEligibilityRoutes.js` - Referral eligibility management
- `brokerageRestrictionRoutes.js` - Brokerage restriction controls
- `gameRoutes.js` - Gaming operations
- `notificationRoutes.js` - Notification management

### Integration Routes
- `binanceRoutes.js` - Binance API integration
- `zerodhaRoutes.js` - Zerodha API integration
- `forexRoutes.js` - Forex market data

## Template Usage

Use `templates/cleanRouteTemplate.js` as a starting point for new route files. It includes:
- Standard structure
- Documentation examples
- Middleware patterns
- Best practices

## Naming Conventions

### File Names
- kebab-case for route files: `user-management.js`
- Descriptive and specific
- Avoid abbreviations

### Route Paths
- RESTful conventions: `/users/:id/profile`
- Consistent parameter names
- Logical grouping

### Controller Functions
- Descriptive action names: `getUserProfile`
- Consistent naming patterns
- Clear purpose

## Middleware Patterns

### Authentication Levels
```javascript
const superAdminAuth = [protectAdmin, superAdminOnly];
const adminAuth = [protectAdmin];
const userAuth = [protectUser];
```

### Validation
- Input validation middleware
- Parameter validation
- Request body validation

## Testing Guidelines

### Route Testing
- Test authentication middleware
- Test authorization levels
- Test error scenarios
- Test success cases

### Documentation Testing
- Verify example responses
- Test documented parameters
- Validate use cases

## Maintenance

### Adding New Routes
1. Use the clean template
2. Follow documentation standards
3. Add proper middleware
4. Include comprehensive examples
5. Update this README

### Modifying Existing Routes
- Maintain backward compatibility
- Update documentation
- Test affected endpoints
- Version breaking changes
