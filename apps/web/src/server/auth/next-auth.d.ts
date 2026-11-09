import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    employeeCode: string;
    fullName: string;
  }

  interface Session {
    user: {
      id: string;
      employeeCode: string;
      fullName: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    employeeCode: string;
    fullName: string;
  }
}
