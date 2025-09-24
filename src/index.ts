interface User {
  username: string;
}

export default function Hello({ username }: User) {
  console.log(`Hello Dear, ${username}`);
}
