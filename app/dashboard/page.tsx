import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/logout/actions";
import { createClient } from "@/lib/supabase/server";

type CourseProgress={courseId:string;title:string;description:string|null;subject:string;progress:number;completedLessons:number;totalLessons:number;masteredConcepts:number;totalConcepts:number;currentLevel:string|null;nextLessonId:string|null;nextLessonTitle:string|null};

export default async function DashboardPage(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const [{data:profile},{data:userCourses}]=await Promise.all([
  supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
  supabase.from("user_courses").select("course_id,last_accessed_at,courses(id,title,description,subject,status)").eq("user_id",user.id).order("last_accessed_at",{ascending:false})
 ]);
 const courseRows=(userCourses??[]).map(item=>{const course=Array.isArray(item.courses)?item.courses[0]:item.courses;return course?{...course,last_accessed_at:item.last_accessed_at}:null}).filter((course):course is NonNullable<typeof course>=>Boolean(course));
 const courseIds=courseRows.map(course=>course.id); const progressByCourse=new Map<string,CourseProgress>();
 if(courseIds.length){
  const {data:levels}=await supabase.from("course_levels").select("id,course_id,title,position").in("course_id",courseIds).order("position");
  const levelIds=(levels??[]).map(level=>level.id);
  const {data:lessons}=levelIds.length?await supabase.from("lessons").select("id,level_id,title,position").in("level_id",levelIds).order("position"):{data:[] as {id:string;level_id:string;title:string;position:number}[]};
  const lessonIds=lessons.map(lesson=>lesson.id);
  const {data:exercises}=lessonIds.length?await supabase.from("exercises").select("id,lesson_id").in("lesson_id",lessonIds):{data:[] as {id:string;lesson_id:string}[]};
  const exerciseIds=exercises.map(exercise=>exercise.id);
  const {data:attempts}=exerciseIds.length?await supabase.from("learning_attempts").select("exercise_id").eq("user_id",user.id).in("exercise_id",exerciseIds):{data:[] as {exercise_id:string}[]};
  const {data:lessonConcepts}=lessonIds.length?await supabase.from("lesson_concepts").select("lesson_id,concept_id").in("lesson_id",lessonIds):{data:[] as {lesson_id:string;concept_id:string}[]};
  const conceptIds=[...new Set(lessonConcepts.map(row=>row.concept_id))];
  const {data:masteryRows}=conceptIds.length?await supabase.from("concept_mastery").select("concept_id,score,needs_review").eq("user_id",user.id).in("concept_id",conceptIds):{data:[] as {concept_id:string;score:number;needs_review:boolean}[]};
  const attemptedExercises=new Set(attempts.map(attempt=>attempt.exercise_id));
  const exercisesByLesson=new Map<string,string[]>(); exercises.forEach(exercise=>exercisesByLesson.set(exercise.lesson_id,[...(exercisesByLesson.get(exercise.lesson_id)??[]),exercise.id]));
  const conceptsByLesson=new Map<string,string[]>(); lessonConcepts.forEach(row=>conceptsByLesson.set(row.lesson_id,[...(conceptsByLesson.get(row.lesson_id)??[]),row.concept_id]));
  const masteryByConcept=new Map(masteryRows.map(row=>[row.concept_id,row])); const levelsById=new Map((levels??[]).map(level=>[level.id,level]));
  const lessonsByCourse=new Map<string,typeof lessons>(); lessons.forEach(lesson=>{const level=levelsById.get(lesson.level_id);if(level) lessonsByCourse.set(level.course_id,[...(lessonsByCourse.get(level.course_id)??[]),lesson]);});
  const isComplete=(lessonId:string)=>{const exerciseList=exercisesByLesson.get(lessonId)??[];const conceptList=conceptsByLesson.get(lessonId)??[];const allMastered=conceptList.length>0&&conceptList.every(id=>{const mastery=masteryByConcept.get(id);return Boolean(mastery&&!mastery.needs_review&&Number(mastery.score)>=.75)});const attempted=exerciseList.filter(id=>attemptedExercises.has(id)).length;return exerciseList.length>=3&&attempted>=Math.min(3,exerciseList.length)&&allMastered;};
  courseRows.forEach(course=>{const courseLessons=(lessonsByCourse.get(course.id)??[]).sort((a,b)=>(levelsById.get(a.level_id)?.position??0)-(levelsById.get(b.level_id)?.position??0)||a.position-b.position);const completedLessons=courseLessons.filter(lesson=>isComplete(lesson.id)).length;const nextLesson=courseLessons.find(lesson=>!isComplete(lesson.id));const courseConceptIds=[...new Set(lessonConcepts.filter(row=>courseLessons.some(lesson=>lesson.id===row.lesson_id)).map(row=>row.concept_id))];const masteredConcepts=courseConceptIds.filter(id=>{const mastery=masteryByConcept.get(id);return Boolean(mastery&&!mastery.needs_review&&Number(mastery.score)>=.75)}).length;const nextLevel=nextLesson?levelsById.get(nextLesson.level_id):null;progressByCourse.set(course.id,{courseId:course.id,title:course.title,description:course.description,subject:course.subject,progress:courseLessons.length?Math.round(completedLessons/courseLessons.length*100):0,completedLessons,totalLessons:courseLessons.length,masteredConcepts,totalConcepts:courseConceptIds.length,currentLevel:nextLevel?.title??(levels??[]).find(level=>level.course_id===course.id)?.title??null,nextLessonId:nextLesson?.id??null,nextLessonTitle:nextLesson?.title??null});});
 }
 const name=profile?.display_name||user.email?.split("@")[0]||"apprenant";
 return <main className="dashboard"><header className="topbar"><Link className="brand" href="/">DUOCOURS</Link><form action={logout}><button className="text-button" type="submit">Déconnexion</button></form></header>
 <section className="dashboard-card"><p className="eyebrow">Ton espace</p><h1>Bonjour, {name}.</h1><p className="subtitle">Reprends un parcours, suis ta progression et avance leçon après leçon.</p><Link className="primary-button" href="/courses/new">Créer un parcours</Link></section>
 {courseRows.length>0?<section className="levels-list dashboard-courses"><div className="level-heading"><div><span className="level-number">Tes parcours</span><h2>Continuer à apprendre</h2></div></div>{courseRows.map(course=>{const progress=progressByCourse.get(course.id);if(!progress)return null;return <article className="course-progress-card" key={course.id}><div className="course-progress-main"><div><span className="level-number">{course.subject}</span><h3>{course.title}</h3>{progress.currentLevel?<p className="course-progress-level">{progress.currentLevel}</p>:null}</div><strong>{progress.progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{width:`${progress.progress}%`}}/></div><div className="course-progress-stats"><span>{progress.completedLessons}/{progress.totalLessons} leçons</span><span>{progress.masteredConcepts}/{progress.totalConcepts} concepts maîtrisés</span></div><div className="course-progress-actions"><Link className="secondary-button" href={`/courses/${course.id}`}>Voir le parcours</Link>{progress.nextLessonId?<Link className="primary-button" href={`/learn/${progress.nextLessonId}`}>{progress.nextLessonTitle?`Continuer · ${progress.nextLessonTitle}`:"Continuer →"}</Link>:<Link className="primary-button" href={`/courses/${course.id}`}>Parcours terminé</Link>}</div></article>})}</section>:null}</main>;
}