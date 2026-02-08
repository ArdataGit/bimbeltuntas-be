const database = require('#database');

async function main() {
  const user = await database.user.createMany({
    data: [
      {
        email: 'admin',
        name: 'Bob',
        noWA: '+123456789',
        jenisKelamin: 'L',
        alamat: 'Jl. Contoh No. 123',
        provinsi: 'Jawa Barat',
        kabupaten: 'Bandung',
        kecamatan: 'Coblong',
        password:
          '$2a$10$Hjzp1MtX/psnNT7icxcd/ee8GR0fsNItOEAwUfMcGw2c8jaHxVbAm',
        gambar: 'https://example.com/bob.jpg',
        role: 'USER',
        verifyAt: '2024-01-21T12:34:56Z',
        createdAt: '2024-01-21T12:00:00Z',
        updatedAt: '2024-01-21T12:30:00Z',
      },
      {
        email: 'alice@database.io',
        name: 'Alice',
        noWA: '+987654321',
        jenisKelamin: 'P',
        alamat: 'Jl. Example No. 456',
        provinsi: 'Jawa Timur',
        kabupaten: 'Surabaya',
        kecamatan: 'Sukolilo',
        password:
          '$2a$10$Hjzp1MtX/psnNT7icxcd/ee8GR0fsNItOEAwUfMcGw2c8jaHxVbAm',
        gambar: 'https://example.com/alice.jpg',
        role: 'USER',
        verifyAt: null,
        createdAt: '2024-01-22T09:00:00Z',
        updatedAt: '2024-01-22T09:30:00Z',
      },
    ],
  });
}
main()
  .then(async () => {
    await database.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await database.$disconnect();
    process.exit(1);
  });
