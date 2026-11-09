import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    employeeCode: string;
    fullName: string;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      employeeCode: string;
      fullName: string;
      sessionVersion: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    employeeCode: string;
    fullName: string;
    sessionVersion: number;
  }
}
