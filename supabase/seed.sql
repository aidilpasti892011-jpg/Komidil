-- =====================================================================
-- KOMIDIL - Data DEMO (cover placeholder, sinopsis demo, bukan konten asli)
-- Jalankan SETELAH 0001_schema.sql. Hapus data ini sebelum rilis sungguhan.
-- =====================================================================
insert into public.genres (name, slug) values
 ('Action','action'),('Adventure','adventure'),('Fantasy','fantasy'),('Romance','romance'),
 ('Comedy','comedy'),('Drama','drama'),('Horror','horror'),('Martial Arts','martial-arts'),
 ('Reincarnation','reincarnation'),('Cultivation','cultivation'),('System','system'),
 ('Regression','regression'),('Slice of Life','slice-of-life'),('Mystery','mystery')
on conflict (slug) do nothing;

create temp table seed_src as
select * from (values
 ('Pewaris Pedang Senja','manhwa','Action,Fantasy,Regression','ongoing',4.8,112,2,350),
 ('Naga Langit Terakhir','manhua','Martial Arts,Cultivation,Action','ongoing',4.7,245,5,28),
 ('Sistem Pemburu Bayangan','manhwa','Action,System,Adventure','ongoing',4.9,98,9,265),
 ('Kembali ke Hari Pertama','manhwa','Regression,Drama','completed',4.6,76,50,200),
 ('Putri Kerajaan Salju','manga','Romance,Fantasy,Drama','ongoing',4.5,64,26,190),
 ('Penjaga Gerbang Reinkarnasi','manhua','Reincarnation,Adventure,Fantasy','ongoing',4.4,180,14,150),
 ('Kafe Hantu Jam Tiga','manga','Comedy,Horror','ongoing',4.3,41,70,300),
 ('Dojo di Ujung Dunia','manga','Martial Arts,Action,Comedy','completed',4.6,120,200,10),
 ('Surat untuk Bintang','manhwa','Romance,Drama','completed',4.7,58,120,320),
 ('Penyihir Tanpa Mana','manhwa','Fantasy,Adventure','hiatus',4.2,33,400,230),
 ('Raja Lembah Kabut','manhua','Cultivation,Fantasy,Martial Arts','ongoing',4.5,310,3,170),
 ('Sekolah Para Pemburu','manga','Action,Comedy,System','ongoing',4.4,87,30,50),
 ('Kurir Lampu Merah','webtoon','Comedy,Slice of Life','ongoing',4.4,60,6,20),
 ('Menara Seratus Lantai','webtoon','Action,Fantasy,Adventure','ongoing',4.6,140,12,260)
) as v(title, type, genres, status, rating, ch, up_hours, hue);

insert into public.comics (slug, title, type, status, synopsis, cover_hue, rating_avg, rating_count,
                           rights_confirmed, rights_note)
select regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'),
       title, type::public.comic_type, status::public.comic_status,
       'Sinopsis demo untuk "' || title || '". Ganti dengan data asli dari admin.',
       hue, rating, (ch / 2)::int, true, 'Data demo KOMIDIL, bukan karya nyata'
from seed_src;

insert into public.comic_genres (comic_id, genre_id)
select c.id, g.id
from seed_src s
join public.comics c on c.title = s.title
cross join lateral unnest(string_to_array(s.genres, ',')) as gn(name)
join public.genres g on g.name = gn.name;

-- 10 chapter demo per komik (tanpa gambar), lalu angka tampilan disamakan dengan data demo
insert into public.chapters (comic_id, number, title, published_at)
select c.id, n, 'Chapter ' || n, now() - make_interval(hours => s.up_hours) - make_interval(mins => (10 - n))
from seed_src s
join public.comics c on c.title = s.title
cross join generate_series(1, least(s.ch, 10)) as n;

update public.comics c set
  chapter_count = s.ch,
  latest_chapter_number = s.ch,
  last_chapter_at = now() - make_interval(hours => s.up_hours)
from seed_src s where c.title = s.title;

drop table seed_src;
